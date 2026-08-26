/**
 * PhilTrace - Database Seeding Script
 * 
 * Standalone TypeScript script that:
 * 1. Connects to Prisma using src/lib/prisma.ts.
 * 2. Seeds the 17 Philippine Regions and all 82 Provinces (+ NCR) into the database.
 *    (Attempts PSA PSGC API if PSA_PSGC_TOKEN is set; falls back to full static array of all 17 regions and 82 provinces).
 * 3. Seeds demo agency accounts (dpwh-admin@philtrace.ph & neda-admin@philtrace.ph) with bcrypt password hashing.
 * 4. Fetches and streams project rows from Hugging Face DPWH datasets in batches of 100 up to 1,500+ projects.
 * 5. Normalizes provinces, computes anomaly flags, upserts projects, and aggregates contractor statistics.
 * 6. Seeds verified citizen whistleblower comments and demo agency updates for flagged projects.
 * 7. Prints a comprehensive summary log.
 * 
 * Usage:
 *   npx tsx scripts/seed-all.ts
 */

import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { buildProvinceLookup } from '../src/lib/province-normalizer';
import { computeAnomalyFlags } from '../src/lib/anomaly-flags';
import { cleanContractorName, parseContractors, formatCurrency } from '../src/lib/format';

// Attempt to load environment variables from .env or .env.local if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath) && (process as any).loadEnvFile) {
    (process as any).loadEnvFile(envLocalPath);
  } else if (fs.existsSync(envPath) && (process as any).loadEnvFile) {
    (process as any).loadEnvFile(envPath);
  }
} catch {
  // Ignore env file load errors in environments where env is already provided
}

// Configuration
const TARGET_PROJECTS_COUNT = process.env.SEED_PROJECT_LIMIT
  ? parseInt(process.env.SEED_PROJECT_LIMIT, 10)
  : 1500;
const HF_BATCH_SIZE = 100;
const BCRYPT_SALT_ROUNDS = 12;

/* ==========================================================================
   1. Complete Static Philippine Regions and Provinces (17 Regions, 82 Provinces + NCR)
   ========================================================================== */

interface StaticRegion {
  psgcCode: string;
  name: string;
  provinces: Array<{ psgcCode: string; name: string }>;
}

export const PHILIPPINE_REGIONS_AND_PROVINCES: StaticRegion[] = [
  {
    psgcCode: '0100000000',
    name: 'Region I (Ilocos Region)',
    provinces: [
      { psgcCode: '012800000', name: 'Ilocos Norte' },
      { psgcCode: '012900000', name: 'Ilocos Sur' },
      { psgcCode: '013300000', name: 'La Union' },
      { psgcCode: '015500000', name: 'Pangasinan' },
    ],
  },
  {
    psgcCode: '0200000000',
    name: 'Region II (Cagayan Valley)',
    provinces: [
      { psgcCode: '020900000', name: 'Batanes' },
      { psgcCode: '021500000', name: 'Cagayan' },
      { psgcCode: '023100000', name: 'Isabela' },
      { psgcCode: '025000000', name: 'Nueva Vizcaya' },
      { psgcCode: '025700000', name: 'Quirino' },
    ],
  },
  {
    psgcCode: '0300000000',
    name: 'Region III (Central Luzon)',
    provinces: [
      { psgcCode: '037700000', name: 'Aurora' },
      { psgcCode: '030800000', name: 'Bataan' },
      { psgcCode: '031400000', name: 'Bulacan' },
      { psgcCode: '034900000', name: 'Nueva Ecija' },
      { psgcCode: '035400000', name: 'Pampanga' },
      { psgcCode: '036900000', name: 'Tarlac' },
      { psgcCode: '037100000', name: 'Zambales' },
    ],
  },
  {
    psgcCode: '0400000000',
    name: 'Region IV-A (CALABARZON)',
    provinces: [
      { psgcCode: '041000000', name: 'Batangas' },
      { psgcCode: '042100000', name: 'Cavite' },
      { psgcCode: '043400000', name: 'Laguna' },
      { psgcCode: '045600000', name: 'Quezon' },
      { psgcCode: '045800000', name: 'Rizal' },
    ],
  },
  {
    psgcCode: '1700000000',
    name: 'MIMAROPA Region',
    provinces: [
      { psgcCode: '174000000', name: 'Marinduque' },
      { psgcCode: '175100000', name: 'Occidental Mindoro' },
      { psgcCode: '175200000', name: 'Oriental Mindoro' },
      { psgcCode: '175300000', name: 'Palawan' },
      { psgcCode: '175900000', name: 'Romblon' },
    ],
  },
  {
    psgcCode: '0500000000',
    name: 'Region V (Bicol Region)',
    provinces: [
      { psgcCode: '050500000', name: 'Albay' },
      { psgcCode: '051600000', name: 'Camarines Norte' },
      { psgcCode: '051700000', name: 'Camarines Sur' },
      { psgcCode: '052000000', name: 'Catanduanes' },
      { psgcCode: '054100000', name: 'Masbate' },
      { psgcCode: '056200000', name: 'Sorsogon' },
    ],
  },
  {
    psgcCode: '0600000000',
    name: 'Region VI (Western Visayas)',
    provinces: [
      { psgcCode: '060400000', name: 'Aklan' },
      { psgcCode: '060600000', name: 'Antique' },
      { psgcCode: '061900000', name: 'Capiz' },
      { psgcCode: '067900000', name: 'Guimaras' },
      { psgcCode: '063000000', name: 'Iloilo' },
      { psgcCode: '064500000', name: 'Negros Occidental' },
    ],
  },
  {
    psgcCode: '0700000000',
    name: 'Region VII (Central Visayas)',
    provinces: [
      { psgcCode: '071200000', name: 'Bohol' },
      { psgcCode: '072200000', name: 'Cebu' },
      { psgcCode: '074600000', name: 'Negros Oriental' },
      { psgcCode: '076100000', name: 'Siquijor' },
    ],
  },
  {
    psgcCode: '0800000000',
    name: 'Region VIII (Eastern Visayas)',
    provinces: [
      { psgcCode: '087800000', name: 'Biliran' },
      { psgcCode: '082600000', name: 'Eastern Samar' },
      { psgcCode: '083700000', name: 'Leyte' },
      { psgcCode: '084800000', name: 'Northern Samar' },
      { psgcCode: '086000000', name: 'Samar' },
      { psgcCode: '086400000', name: 'Southern Leyte' },
    ],
  },
  {
    psgcCode: '0900000000',
    name: 'Region IX (Zamboanga Peninsula)',
    provinces: [
      { psgcCode: '097200000', name: 'Zamboanga del Norte' },
      { psgcCode: '097300000', name: 'Zamboanga del Sur' },
      { psgcCode: '098300000', name: 'Zamboanga Sibugay' },
    ],
  },
  {
    psgcCode: '1000000000',
    name: 'Region X (Northern Mindanao)',
    provinces: [
      { psgcCode: '101300000', name: 'Bukidnon' },
      { psgcCode: '101800000', name: 'Camiguin' },
      { psgcCode: '103500000', name: 'Lanao del Norte' },
      { psgcCode: '104200000', name: 'Misamis Occidental' },
      { psgcCode: '104300000', name: 'Misamis Oriental' },
    ],
  },
  {
    psgcCode: '1100000000',
    name: 'Region XI (Davao Region)',
    provinces: [
      { psgcCode: '118200000', name: 'Davao de Oro' },
      { psgcCode: '112300000', name: 'Davao del Norte' },
      { psgcCode: '112400000', name: 'Davao del Sur' },
      { psgcCode: '118600000', name: 'Davao Occidental' },
      { psgcCode: '112500000', name: 'Davao Oriental' },
    ],
  },
  {
    psgcCode: '1200000000',
    name: 'Region XII (SOCCSKSARGEN)',
    provinces: [
      { psgcCode: '124700000', name: 'Cotabato' },
      { psgcCode: '128000000', name: 'Sarangani' },
      { psgcCode: '126300000', name: 'South Cotabato' },
      { psgcCode: '126500000', name: 'Sultan Kudarat' },
    ],
  },
  {
    psgcCode: '1600000000',
    name: 'Region XIII (Caraga)',
    provinces: [
      { psgcCode: '160200000', name: 'Agusan del Norte' },
      { psgcCode: '160300000', name: 'Agusan del Sur' },
      { psgcCode: '168500000', name: 'Dinagat Islands' },
      { psgcCode: '166700000', name: 'Surigao del Norte' },
      { psgcCode: '166800000', name: 'Surigao del Sur' },
    ],
  },
  {
    psgcCode: '1400000000',
    name: 'Cordillera Administrative Region (CAR)',
    provinces: [
      { psgcCode: '140100000', name: 'Abra' },
      { psgcCode: '148100000', name: 'Apayao' },
      { psgcCode: '141100000', name: 'Benguet' },
      { psgcCode: '142700000', name: 'Ifugao' },
      { psgcCode: '143200000', name: 'Kalinga' },
      { psgcCode: '144400000', name: 'Mountain Province' },
    ],
  },
  {
    psgcCode: '1900000000',
    name: 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)',
    provinces: [
      { psgcCode: '190700000', name: 'Basilan' },
      { psgcCode: '193600000', name: 'Lanao del Sur' },
      { psgcCode: '198700000', name: 'Maguindanao del Norte' },
      { psgcCode: '198800000', name: 'Maguindanao del Sur' },
      { psgcCode: '196600000', name: 'Sulu' },
      { psgcCode: '197000000', name: 'Tawi-Tawi' },
    ],
  },
  {
    psgcCode: '1300000000',
    name: 'National Capital Region (NCR)',
    provinces: [
      { psgcCode: '133900000', name: 'Metropolitan Manila' },
    ],
  },
];

/* ==========================================================================
   2. PSGC Seeding (PSA API with static fallback)
   ========================================================================== */

interface PSGCRegionApi {
  code: string;
  name: string;
}

interface PSGCProvinceApi {
  code: string;
  name: string;
}

async function seedPSGC(): Promise<{ regions: number; provinces: number }> {
  console.log('\n[1/5] Seeding Regions and Provinces...');
  const token = process.env.PSA_PSGC_TOKEN;
  let populatedFromApi = false;
  let regionCount = 0;
  let provinceCount = 0;

  if (token) {
    try {
      console.log('  -> PSA_PSGC_TOKEN found. Attempting PSA PSGC API sync...');
      const regionsRes = await fetch(
        `https://classification.psa.gov.ph/psgc/v2/regions?token=${token}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (regionsRes.ok) {
        const regionsData = (await regionsRes.json()) as PSGCRegionApi[];
        if (Array.isArray(regionsData) && regionsData.length > 0) {
          for (const region of regionsData) {
            const dbRegion = await prisma.region.upsert({
              where: { psgcCode: region.code },
              update: { name: region.name },
              create: { psgcCode: region.code, name: region.name },
            });
            regionCount++;

            // Fetch provinces for region
            try {
              const provRes = await fetch(
                `https://classification.psa.gov.ph/psgc/v2/provinces?token=${token}&reg=${region.code}`,
                { signal: AbortSignal.timeout(6000) }
              );
              if (provRes.ok) {
                const provincesData = (await provRes.json()) as PSGCProvinceApi[];
                if (Array.isArray(provincesData)) {
                  for (const p of provincesData) {
                    await prisma.province.upsert({
                      where: { psgcCode: p.code },
                      update: { name: p.name, regionId: dbRegion.id },
                      create: { psgcCode: p.code, name: p.name, regionId: dbRegion.id },
                    });
                    provinceCount++;
                  }
                }
              }
            } catch (pErr) {
              console.warn(`    Warning: Could not fetch provinces for ${region.name} via API.`);
            }
          }
          populatedFromApi = true;
          console.log(`  -> PSA PSGC API: Loaded ${regionCount} regions and ${provinceCount} provinces.`);
        }
      }
    } catch (apiErr) {
      console.warn('  -> PSA PSGC API request failed or timed out. Using static fallback data.');
    }
  }

  // Ensure full coverage by applying complete static fallback array
  if (!populatedFromApi || regionCount < 17 || provinceCount < 82) {
    console.log('  -> Applying complete static array (17 Regions, 82 Provinces + NCR)...');
    regionCount = 0;
    provinceCount = 0;

    for (const reg of PHILIPPINE_REGIONS_AND_PROVINCES) {
      const dbRegion = await prisma.region.upsert({
        where: { psgcCode: reg.psgcCode },
        update: { name: reg.name },
        create: {
          psgcCode: reg.psgcCode,
          name: reg.name,
        },
      });
      regionCount++;

      for (const prov of reg.provinces) {
        await prisma.province.upsert({
          where: { psgcCode: prov.psgcCode },
          update: {
            name: prov.name,
            regionId: dbRegion.id,
          },
          create: {
            psgcCode: prov.psgcCode,
            name: prov.name,
            regionId: dbRegion.id,
          },
        });
        provinceCount++;
      }
    }
    console.log(`  -> Static Fallback: Upserted ${regionCount} Regions and ${provinceCount} Provinces.`);
  }

  const finalRegionCount = await prisma.region.count();
  const finalProvinceCount = await prisma.province.count();
  console.log(`  ✓ Database verified: ${finalRegionCount} Regions, ${finalProvinceCount} Provinces in DB.`);

  return { regions: finalRegionCount, provinces: finalProvinceCount };
}

/* ==========================================================================
   3. Agency Accounts Seeding
   ========================================================================== */

async function seedAgencyAccounts(): Promise<number> {
  console.log('\n[2/5] Seeding Demo Agency Accounts...');

  const agencies = [
    {
      email: 'dpwh-admin@philtrace.ph',
      password: 'dpwh-demo-2026',
      agencyName: 'Department of Public Works and Highways',
    },
    {
      email: 'neda-admin@philtrace.ph',
      password: 'neda-demo-2026',
      agencyName: 'National Economic and Development Authority',
    },
  ];

  let count = 0;
  for (const agency of agencies) {
    const passwordHash = await bcrypt.hash(agency.password, BCRYPT_SALT_ROUNDS);
    await prisma.agencyAccount.upsert({
      where: { email: agency.email },
      update: {
        passwordHash,
        agencyName: agency.agencyName,
      },
      create: {
        email: agency.email,
        passwordHash,
        agencyName: agency.agencyName,
      },
    });
    console.log(`  ✓ Seeded Account: ${agency.email} (${agency.agencyName})`);
    count++;
  }

  return count;
}

/* ==========================================================================
   4. Hugging Face / DPWH Projects Seeding & Contractor Aggregation
   ========================================================================== */

interface RawHFProject {
  contractId: string;
  description: string;
  category?: string;
  status?: string;
  budget?: number | string;
  amountPaid?: number | string;
  progress?: number | string;
  location?: {
    province?: string;
    region?: string;
  };
  contractor?: string;
  startDate?: string;
  completionDate?: string | null;
  infraYear?: string;
  programName?: string;
  sourceOfFunds?: string;
  isLive?: boolean;
  livestreamUrl?: string | null;
  latitude?: number | string;
  longitude?: number | string;
  reportCount?: number | string;
  hasSatelliteImage?: boolean;
}

interface HFResponse {
  rows?: Array<{ row: RawHFProject }>;
  num_rows_total?: number;
}

// Fallback project generator if HuggingFace is unreachable
function generateFallbackProjects(targetCount: number, provinces: Array<{ id: string; name: string; region: { name: string } }>): RawHFProject[] {
  const fallbackList: RawHFProject[] = [];
  const categories = [
    'Roads',
    'Bridges',
    'Flood Control and Drainage',
    'Buildings and Facilities',
    'Water Provision and Storage',
  ];
  const contractors = [
    'R.D. POLICARPIO & COMPANY INC. (12845)',
    'SAN ROQUE BUILDERS & CONST. SUPPLY (33841)',
    'CT LEONCIO CONSTRUCTION & TRADING (19032)',
    'E.C. DE LUNA CONSTRUCTION CORP. (08291)',
    'PRIME PAVING & INFRASTRUCTURE CORP (24510)',
    'ALPHA & OMEGA GEN. CONTRACTOR & DEV. CORP. (31450)',
    'SUNWEST CONSTRUCTION & DEV. CORP. (18742)',
    'V.V. ALDUAN CONSTRUCTION (09214)',
    'MAC BUILDERS & SUPPLY (11204)',
    'SILVER DRAGON CONSTRUCTION & LUMBER & GLASS (04921)',
    'LEGACY CONSTRUCTION CORPORATION (28419)',
    'ROYAL CROWN MONARCH CONST. & SUPPLIES (14720)',
    'B.M. MARKETING & CONSTRUCTION (38201)',
  ];
  const statuses = ['On-Going', 'Completed', 'Not Yet Started', 'Suspended', 'Terminated'];
  const sources = [
    'Regular Infra - GAA 2023 OO-1',
    'Regular Infra - GAA 2024 OO-2',
    'Outside Infra - GAA 2022 DA FMR',
    'Flood Management Program - GAA 2023',
    'Local Infrastructure Program - GAA 2024',
  ];

  for (let i = 0; i < targetCount; i++) {
    const prov = provinces[i % provinces.length];
    const category = categories[i % categories.length];
    const contractor = contractors[i % contractors.length];
    const status = statuses[i % statuses.length];
    const budget = Math.round((2_000_000 + (i * 357_911) % 180_000_000) * 100) / 100;
    
    let progress = 0;
    let amountPaid = 0;
    if (status === 'Completed') {
      progress = 100;
      amountPaid = budget;
    } else if (status === 'On-Going') {
      progress = Math.round(((i * 7) % 95) * 10) / 10;
      amountPaid = Math.round((budget * (progress / 100) * 0.9) * 100) / 100;
    } else if (status === 'Suspended' || status === 'Terminated') {
      progress = Math.round(((i * 3) % 40) * 10) / 10;
      amountPaid = Math.round((budget * 0.6) * 100) / 100; // potential overpaid flag
    }

    const year = 2021 + (i % 4);
    const startMonth = 1 + (i % 12);
    const startDate = `${year}-${String(startMonth).padStart(2, '0')}-15`;
    const completionDate = `${year + 1}-${String((startMonth + 6) % 12 || 12).padStart(2, '0')}-28`;

    // Coordinates bounding box for the Philippines (Lat: 5 to 19, Lng: 119 to 126)
    const lat = 7.0 + ((i * 1.37) % 11.5);
    const lng = 120.0 + ((i * 1.19) % 5.8);

    fallbackList.push({
      contractId: `${String(year).slice(2)}AB${String(1000 + i).slice(1)}`,
      description: `CONSTRUCTION / REHABILITATION OF ${category.toUpperCase()} AT ${prov.name.toUpperCase()}, ${prov.region.name.toUpperCase()}`,
      category,
      status,
      budget,
      amountPaid,
      progress,
      location: {
        province: prov.name,
        region: prov.region.name,
      },
      contractor,
      startDate,
      completionDate,
      infraYear: String(year),
      programName: 'Regular Infrastructure Program',
      sourceOfFunds: sources[i % sources.length],
      isLive: i % 15 === 0,
      livestreamUrl: i % 15 === 0 ? `https://www.youtube.com/watch?v=demo${i}` : null,
      latitude: lat,
      longitude: lng,
      reportCount: i % 12 === 0 ? 3 : 0,
      hasSatelliteImage: i % 4 !== 0,
    });
  }

  return fallbackList;
}

async function fetchHuggingFaceProjects(targetCount: number): Promise<{ projects: RawHFProject[]; source: string }> {
  // Datasets endpoints to try in order
  const datasetCandidates = [
    'c4rv3r/dpwh-transparency-data',
    'bettergovph/dpwh-transparency-data',
    'TEMSY001/dpwh-transparency-data',
  ];

  for (const datasetName of datasetCandidates) {
    try {
      console.log(`  -> Attempting to fetch rows from Hugging Face dataset "${datasetName}"...`);
      const fetchedProjects: RawHFProject[] = [];
      let offset = 0;
      let hasMore = true;
      let totalDatasetRows = 0;

      while (fetchedProjects.length < targetCount && hasMore) {
        const fetchLength = Math.min(HF_BATCH_SIZE, targetCount - fetchedProjects.length);
        const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(datasetName)}&config=default&split=train&offset=${offset}&length=${fetchLength}`;

        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) {
          console.warn(`    HF API returned status ${res.status} at offset ${offset}.`);
          break;
        }

        const data = (await res.json()) as HFResponse;
        if (!data.rows || data.rows.length === 0) {
          hasMore = false;
          break;
        }

        totalDatasetRows = data.num_rows_total || 0;
        for (const item of data.rows) {
          if (item && item.row) {
            fetchedProjects.push(item.row);
          }
        }

        offset += fetchLength;
        const progressPct = Math.min(100, Math.round((fetchedProjects.length / targetCount) * 100));
        process.stdout.write(`\r     Progress: [${progressPct}%] ${fetchedProjects.length}/${targetCount} fetched...`);

        // Small delay to be polite to HF API
        await new Promise((r) => setTimeout(r, 120));
      }

      console.log(''); // newline
      if (fetchedProjects.length >= 100) {
        console.log(`  ✓ Successfully fetched ${fetchedProjects.length} projects from Hugging Face (${datasetName}).`);
        return { projects: fetchedProjects, source: `huggingface:${datasetName}` };
      }
    } catch (err: any) {
      console.warn(`  -> Failed fetching from "${datasetName}": ${err?.message || err}`);
    }
  }

  // Fallback if HF APIs are down or unreachable
  console.log('  -> Note: Hugging Face server unreachable or restricted. Generating high-fidelity realistic DPWH dataset...');
  const allProvs = await prisma.province.findMany({ include: { region: true } });
  const fallback = generateFallbackProjects(targetCount, allProvs);
  return { projects: fallback, source: 'synthetic-dpwh-dataset' };
}

async function seedProjectsAndContractors(targetCount: number): Promise<{ projectsCount: number; contractorsCount: number }> {
  console.log(`\n[3/5] Fetching and Seeding ${targetCount}+ Projects...`);

  // Load regions & provinces for normalization
  const [regions, provinces] = await Promise.all([
    prisma.region.findMany(),
    prisma.province.findMany(),
  ]);

  if (provinces.length === 0) {
    throw new Error('Provinces must be seeded before seeding projects.');
  }

  const lookupProvince = buildProvinceLookup(provinces, regions);
  const { projects: rawProjects, source } = await fetchHuggingFaceProjects(targetCount);

  console.log(`  -> Processing and upserting ${rawProjects.length} project records...`);

  let upsertedCount = 0;
  let unmappedCount = 0;
  const contractorStats = new Map<
    string,
    { count: number; totalValue: number; totalProgress: number; overdueCount: number; terminatedCount: number }
  >();

  const defaultProvinceId = provinces[0]?.id;

  for (let i = 0; i < rawProjects.length; i++) {
    const raw = rawProjects[i];

    const rawProvince = raw.location?.province || '';
    const rawRegion = raw.location?.region || '';
    let provinceId = lookupProvince(rawProvince, rawRegion);

    if (!provinceId) {
      unmappedCount++;
      provinceId = defaultProvinceId;
    }

    // Parse and sanitize numeric and date values
    const budgetPHP = Math.max(0, Number(raw.budget) || 0);
    const amountPaid = Math.max(0, Number(raw.amountPaid) || 0);
    const progress = Math.min(100, Math.max(0, Number(raw.progress) || 0));

    let startDate = raw.startDate ? new Date(raw.startDate) : new Date('2023-01-01');
    if (isNaN(startDate.getTime())) startDate = new Date('2023-01-01');

    let completionDate = raw.completionDate ? new Date(raw.completionDate) : null;
    if (completionDate && isNaN(completionDate.getTime())) completionDate = null;

    const status = raw.status || (progress === 100 ? 'Completed' : 'On-Going');
    const category = raw.category || 'Roads';
    const contractorRaw = raw.contractor || 'DPWH Direct Management';
    const description = raw.description || `DPWH Infrastructure Contract ${raw.contractId}`;
    const gpsLat = Number(raw.latitude) || 12.8797;
    const gpsLng = Number(raw.longitude) || 121.774;

    // Compute anomaly flags
    const flags = computeAnomalyFlags(
      {
        status,
        progress,
        startDate,
        completionDate,
        amountPaid,
        budgetPHP,
      },
      null, // Latest agency update check
      Number(raw.reportCount) || 0
    );

    const projectId = String(raw.contractId).trim();

    try {
      await prisma.project.upsert({
        where: { id: projectId },
        update: {
          name: description,
          provinceId,
          gpsLat,
          gpsLng,
          budgetPHP,
          amountPaid,
          progress,
          startDate,
          completionDate,
          status,
          category,
          contractorRaw,
          sourceOfFunds: raw.sourceOfFunds || null,
          programName: raw.programName || null,
          infraYear: raw.infraYear ? String(raw.infraYear) : null,
          isLive: Boolean(raw.isLive),
          livestreamUrl: raw.livestreamUrl || null,
          hasSatelliteImage: Boolean(raw.hasSatelliteImage),
          reportCount: Number(raw.reportCount) || 0,
          syncSource: source,
          ...flags,
        },
        create: {
          id: projectId,
          name: description,
          provinceId,
          gpsLat,
          gpsLng,
          budgetPHP,
          amountPaid,
          progress,
          startDate,
          completionDate,
          status,
          category,
          contractorRaw,
          sourceOfFunds: raw.sourceOfFunds || null,
          programName: raw.programName || null,
          infraYear: raw.infraYear ? String(raw.infraYear) : null,
          isLive: Boolean(raw.isLive),
          livestreamUrl: raw.livestreamUrl || null,
          hasSatelliteImage: Boolean(raw.hasSatelliteImage),
          reportCount: Number(raw.reportCount) || 0,
          syncSource: source,
          ...flags,
        },
      });

      upsertedCount++;

      // Track contractor stats
      const contractorNames = parseContractors(contractorRaw);
      for (const rawName of contractorNames) {
        const cleaned = cleanContractorName(rawName);
        if (!cleaned || cleaned.length < 2) continue;

        const current = contractorStats.get(cleaned) ?? {
          count: 0,
          totalValue: 0,
          totalProgress: 0,
          overdueCount: 0,
          terminatedCount: 0,
        };

        current.count += 1;
        current.totalValue += budgetPHP;
        current.totalProgress += progress;
        if (flags.flagOverdue) current.overdueCount += 1;
        if (status === 'Terminated') current.terminatedCount += 1;

        contractorStats.set(cleaned, current);
      }
    } catch (err: any) {
      console.warn(`    Failed to upsert project ${projectId}: ${err?.message || err}`);
    }

    if ((i + 1) % 250 === 0 || i === rawProjects.length - 1) {
      const pct = Math.round(((i + 1) / rawProjects.length) * 100);
      console.log(`    Upserted ${upsertedCount}/${rawProjects.length} projects (${pct}%)...`);
    }
  }

  // Update Contractor Table
  console.log(`\n  -> Aggregating and upserting ${contractorStats.size} contractor profiles...`);
  let contractorUpsertCount = 0;

  for (const [name, stats] of contractorStats) {
    try {
      const avgProgress = stats.count > 0 ? Math.round((stats.totalProgress / stats.count) * 10) / 10 : 0;
      await prisma.contractor.upsert({
        where: { name },
        update: {
          totalContracts: stats.count,
          totalValuePHP: stats.totalValue,
          avgProgress,
          overdueCount: stats.overdueCount,
          terminatedCount: stats.terminatedCount,
        },
        create: {
          name,
          totalContracts: stats.count,
          totalValuePHP: stats.totalValue,
          avgProgress,
          overdueCount: stats.overdueCount,
          terminatedCount: stats.terminatedCount,
        },
      });
      contractorUpsertCount++;
    } catch (cErr: any) {
      console.warn(`    Failed to upsert contractor "${name}": ${cErr?.message || cErr}`);
    }
  }

  // Log Sync
  await prisma.syncLog.create({
    data: {
      source,
      count: upsertedCount,
      success: true,
    },
  });

  console.log(`  ✓ Successfully upserted ${upsertedCount} projects and ${contractorUpsertCount} contractors.`);
  if (unmappedCount > 0) {
    console.log(`  ℹ ${unmappedCount} projects fell back to default province due to unlisted DEO naming.`);
  }

  return { projectsCount: upsertedCount, contractorsCount: contractorUpsertCount };
}

/* ==========================================================================
   5. Sample Whistleblower Reports & Agency Updates
   ========================================================================== */

async function seedWhistleblowerAndUpdates(): Promise<{ commentsCount: number; updatesCount: number }> {
  console.log('\n[4/5] Seeding Verified Whistleblower Comments & Agency Updates...');

  // Find flagged or live projects to attach rich demo data
  const sampleProjects = await prisma.project.findMany({
    take: 12,
    where: {
      OR: [
        { flagStalled: true },
        { flagOverdue: true },
        { flagOverpaid: true },
        { flagNeverStarted: true },
        { isLive: true },
      ],
    },
    orderBy: { budgetPHP: 'desc' },
  });

  // If not enough flagged projects found, grab top projects
  const targetProjects =
    sampleProjects.length >= 6
      ? sampleProjects
      : await prisma.project.findMany({ take: 8, orderBy: { budgetPHP: 'desc' } });

  const sampleWhistleblowerReports = [
    {
      text: 'Walang tao sa construction site for over 6 months na. Nakatiwangwang lang ang mga bakal at kinakalawang na. Matinding traffic pa ang dulot sa mga commuters araw-araw dahil sa baradong kalsada.',
      severity: 'critical',
      rationale: 'Prolonged abandonment of public roadway creating severe vehicular hazard and economic disruption.',
      corroborationCount: 18,
    },
    {
      text: 'Project billboard states 100% completed as of last quarter, but the bridge approach is still completely unpaved with visible erosion on the riverbank footing.',
      severity: 'critical',
      rationale: 'Direct discrepancy between official completion reporting and physical structural hazard.',
      corroborationCount: 12,
    },
    {
      text: 'All heavy equipment was pulled out last October. Open drainage trenches along the school zone have no safety barricades or warning lights.',
      severity: 'high',
      rationale: 'Unattended excavation near public school posing imminent risk of injury to pedestrians.',
      corroborationCount: 24,
    },
    {
      text: 'Notice to Proceed was awarded over 14 months ago. Zero physical mobilization on-site. No DPWH project billboard or fence installed.',
      severity: 'medium',
      rationale: 'Prolonged start delay with lack of transparency signboard required by DPWH regulations.',
      corroborationCount: 9,
    },
    {
      text: 'Substandard concrete pouring observed during continuous torrential rain. Surface cracking already visible along the 500-meter bypass lane after 3 weeks.',
      severity: 'high',
      rationale: 'Compromised pavement integrity due to improper curing and weather conditions during laying.',
      corroborationCount: 31,
    },
    {
      text: 'Flood control revetment collapsed during the latest monsoon surge. Broken sheet piles are now clogging the river mouth.',
      severity: 'critical',
      rationale: 'Structural failure of flood mitigation project causing increased flood vulnerability for nearby barangays.',
      corroborationCount: 42,
    },
    {
      text: 'Pavement thickness appears significantly thinner than the 280mm specified in the DPWH standard engineering design.',
      severity: 'medium',
      rationale: 'Potential material spec deviation requiring independent core testing by DPWH Bureau of Quality.',
      corroborationCount: 7,
    },
    {
      text: 'Contractor workers reported unpaid wages for 3 cut-offs. Work has ground to a complete halt.',
      severity: 'high',
      rationale: 'Contractor financial distress and labor dispute causing indefinite project stoppage.',
      corroborationCount: 15,
    },
  ];

  let commentsCount = 0;
  for (let i = 0; i < targetProjects.length; i++) {
    const proj = targetProjects[i];
    const report = sampleWhistleblowerReports[i % sampleWhistleblowerReports.length];

    await prisma.comment.create({
      data: {
        projectId: proj.id,
        text: report.text,
        severity: report.severity,
        rationale: report.rationale,
        phoneVerified: true,
        corroborationCount: report.corroborationCount,
        photoUrl: null,
      },
    });

    await prisma.project.update({
      where: { id: proj.id },
      data: {
        reportCount: { increment: 1 },
        lastActivityAt: new Date(),
      },
    });

    commentsCount++;
  }

  // Seed sample agency official updates
  const sampleUpdates = [
    {
      agencyName: 'Department of Public Works and Highways',
      percentDone: 65,
      note: 'DPWH Regional Inspectorate conducted on-site audit. Formal Notice of Delay (NOD) issued to contractor with 15-day rectification order.',
    },
    {
      agencyName: 'National Economic and Development Authority',
      percentDone: 70,
      note: 'NEDA Regional Project Monitoring Committee (RPMC) validated catch-up plan submitted by contractor for Q3 completion.',
    },
    {
      agencyName: 'Department of Public Works and Highways',
      percentDone: 45,
      note: 'Right-of-Way (ROW) acquisition issue in Station 12+400 resolved in coordination with Provincial LGU. Construction resumed.',
    },
  ];

  let updatesCount = 0;
  for (let j = 0; j < Math.min(3, targetProjects.length); j++) {
    const proj = targetProjects[j];
    const upd = sampleUpdates[j];

    await prisma.agencyUpdate.create({
      data: {
        projectId: proj.id,
        agencyName: upd.agencyName,
        percentDone: upd.percentDone,
        note: upd.note,
      },
    });

    updatesCount++;
  }

  console.log(`  ✓ Seeded ${commentsCount} verified whistleblower comments and ${updatesCount} agency updates.`);
  return { commentsCount, updatesCount };
}

/* ==========================================================================
   6. Main Seeding Orchestrator & Summary
   ========================================================================== */

async function main() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('          🇵🇭 PHILTRACE DATABASE SEEDING ENGINE 🇵🇭            ');
  console.log('================================================================');
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log(`  Target Projects: ${TARGET_PROJECTS_COUNT}`);
  console.log('----------------------------------------------------------------');

  try {
    // Step 1: Regions & Provinces
    const psgcStats = await seedPSGC();

    // Step 2: Agency Accounts
    const agencyCount = await seedAgencyAccounts();

    // Step 3: Projects and Contractors
    const projectStats = await seedProjectsAndContractors(TARGET_PROJECTS_COUNT);

    // Step 4: Whistleblower Reports and Agency Updates
    const feedbackStats = await seedWhistleblowerAndUpdates();

    // Fetch final database metrics
    const [
      totalRegions,
      totalProvinces,
      totalProjects,
      totalContractors,
      totalComments,
      totalUpdates,
      flaggedStalled,
      flaggedOverdue,
      flaggedOverpaid,
      flaggedNeverStarted,
    ] = await Promise.all([
      prisma.region.count(),
      prisma.province.count(),
      prisma.project.count(),
      prisma.contractor.count(),
      prisma.comment.count(),
      prisma.agencyUpdate.count(),
      prisma.project.count({ where: { flagStalled: true } }),
      prisma.project.count({ where: { flagOverdue: true } }),
      prisma.project.count({ where: { flagOverpaid: true } }),
      prisma.project.count({ where: { flagNeverStarted: true } }),
    ]);

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n================================================================');
    console.log('              🎉 SEEDING COMPLETED SUCCESSFULLY 🎉              ');
    console.log('================================================================');
    console.log(`  ⏱️  Total Duration : ${elapsedSeconds} seconds`);
    console.log('----------------------------------------------------------------');
    console.log(`  📍 Regions Seeded          : ${totalRegions} / 17`);
    console.log(`  🗺️  Provinces Seeded        : ${totalProvinces} / 82+`);
    console.log(`  🏢 Agency Accounts         : ${agencyCount} (DPWH & NEDA demo)`);
    console.log(`  🏗️  Total Projects          : ${totalProjects}`);
    console.log(`  👷 Contractors Aggregated  : ${totalContractors}`);
    console.log(`  📢 Whistleblower Reports   : ${totalComments} (Phone-verified)`);
    console.log(`  📝 Agency Field Updates    : ${totalUpdates}`);
    console.log('----------------------------------------------------------------');
    console.log('  🔍 Anomaly Flags Summary:');
    console.log(`     - Stalled Projects      : ${flaggedStalled}`);
    console.log(`     - Overdue Projects      : ${flaggedOverdue}`);
    console.log(`     - Overpaid Projects     : ${flaggedOverpaid}`);
    console.log(`     - Never Started         : ${flaggedNeverStarted}`);
    console.log('================================================================\n');
  } catch (error) {
    console.error('\n❌ Fatal Seeding Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute seeding
main();
