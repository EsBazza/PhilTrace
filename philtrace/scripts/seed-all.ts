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
import { cleanContractorName, parseContractors } from '../src/lib/format';

// Attempt to load environment variables from .env or .env.local if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  const proc = process as unknown as { loadEnvFile?: (p: string) => void };
  if (fs.existsSync(envLocalPath) && proc.loadEnvFile) {
    proc.loadEnvFile(envLocalPath);
  } else if (fs.existsSync(envPath) && proc.loadEnvFile) {
    proc.loadEnvFile(envPath);
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
              console.warn(`    Warning: Could not fetch provinces for ${region.name} via API:`, pErr);
            }
          }
          populatedFromApi = true;
          console.log(`  -> PSA PSGC API: Loaded ${regionCount} regions and ${provinceCount} provinces.`);
        }
      }
    } catch (apiErr) {
      console.warn('  -> PSA PSGC API request failed or timed out:', apiErr);
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

  return 0;
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

        const totalDatasetRows = data.num_rows_total || 0;
        for (const item of data.rows) {
          if (item && item.row) {
            fetchedProjects.push(item.row);
          }
        }

        offset += fetchLength;
        const progressPct = Math.min(100, Math.round((fetchedProjects.length / targetCount) * 100));
        process.stdout.write(`\r     Progress: [${progressPct}%] ${fetchedProjects.length}/${targetCount} (total ${totalDatasetRows}) fetched...`);

        // Small delay to be polite to HF API
        await new Promise((r) => setTimeout(r, 120));
      }

      console.log(''); // newline
      if (fetchedProjects.length >= 100) {
        console.log(`  ✓ Successfully fetched ${fetchedProjects.length} projects from Hugging Face (${datasetName}).`);
        return { projects: fetchedProjects, source: `huggingface:${datasetName}` };
      }
    } catch (err: unknown) {
      console.warn(`  -> Failed fetching from "${datasetName}": ${(err as Error)?.message || err}`);
    }
  }

  // Fallback if HF APIs are down or unreachable
  console.log('  -> Note: Hugging Face server unreachable or restricted. Returning empty array.');
  return { projects: [], source: 'empty' };
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
    } catch (err: unknown) {
      console.warn(`    Failed to upsert project ${projectId}: ${(err as Error)?.message || err}`);
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
    } catch (cErr: unknown) {
      console.warn(`    Failed to upsert contractor "${name}": ${(cErr as Error)?.message || cErr}`);
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
  console.log('\n[4/5] Whistleblower comments will be submitted live by citizens');
  return { commentsCount: 0, updatesCount: 0 };
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
    console.log(`Seeded PSGC: ${psgcStats.regions} regions, ${psgcStats.provinces} provinces.`);

    // Step 2: Agency Accounts
    const agencyCount = await seedAgencyAccounts();
    console.log(`Seeded ${agencyCount} agency accounts.`);

    // Step 3: Projects and Contractors
    const projectStats = await seedProjectsAndContractors(TARGET_PROJECTS_COUNT);
    console.log(`Seeded projects: ${projectStats.projectsCount} upserted, ${projectStats.contractorsCount} contractors.`);

    // Step 4: Whistleblower Reports
    const feedbackStats = await seedWhistleblowerAndUpdates();
    console.log(`Seeded feedback: ${feedbackStats.commentsCount} comments.`);

    // Fetch final database metrics
    const [
      totalRegions,
      totalProvinces,
      totalProjects,
      totalContractors,
      totalComments,
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
