import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { computeAnomalyFlags } from '@/lib/anomaly-flags';
import { buildProvinceLookup } from '@/lib/province-normalizer';
import { cleanContractorName, parseContractors } from '@/lib/format';
import { DPWH_API_BASE, HF_DATASET_API, HF_DATASET_NAME, SYNC_DELAY_MS, SYNC_BATCH_SIZE } from '@/lib/constants';

interface DPWHProject {
  contractId: string;
  description: string;
  category: string;
  status: string;
  budget: number;
  amountPaid: number;
  progress: number;
  location: { province: string; region: string };
  contractor: string;
  startDate: string;
  completionDate: string | null;
  infraYear: string;
  programName: string;
  sourceOfFunds: string;
  latitude: number;
  longitude: number;
  reportCount: number;
  hasSatelliteImage: boolean;
}

interface HFRowsResponse {
  rows: Array<{ row: DPWHProject }>;
  num_rows_total: number;
}

async function fetchFromDPWH(): Promise<DPWHProject[] | null> {
  try {
    const allProjects: DPWHProject[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(`${DPWH_API_BASE}?page=${page}&limit=100`, {
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        console.error(`DPWH API returned ${res.status} on page ${page}`);
        return null;
      }

      const data = await res.json() as DPWHProject[];
      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false;
      } else {
        allProjects.push(...data);
        page++;
        // Respect rate limits
        await new Promise((resolve) => setTimeout(resolve, SYNC_DELAY_MS));
      }

      // Safety cap
      if (page > 3000) break;
    }

    return allProjects.length > 0 ? allProjects : null;
  } catch (error) {
    console.error('DPWH API fetch failed:', error);
    return null;
  }
}

async function fetchFromHuggingFace(): Promise<DPWHProject[] | null> {
  try {
    const allProjects: DPWHProject[] = [];
    let offset = 0;
    const length = 100;
    let totalRows = Infinity;

    while (offset < totalRows) {
      const url = `${HF_DATASET_API}?dataset=${encodeURIComponent(HF_DATASET_NAME)}&config=default&split=train&offset=${offset}&length=${length}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        console.error(`HF API returned ${res.status} at offset ${offset}`);
        break;
      }

      const data = await res.json() as HFRowsResponse;
      totalRows = data.num_rows_total;

      if (!data.rows || data.rows.length === 0) break;

      for (const row of data.rows) {
        allProjects.push(row.row);
      }

      offset += length;
      await new Promise((resolve) => setTimeout(resolve, SYNC_DELAY_MS));

      // Safety cap
      if (offset > 300000) break;
    }

    return allProjects.length > 0 ? allProjects : null;
  } catch (error) {
    console.error('HuggingFace API fetch failed:', error);
    return null;
  }
}

async function upsertProjects(projects: DPWHProject[], source: string): Promise<number> {
  // Load province lookup
  const [regions, provinces] = await Promise.all([
    prisma.region.findMany(),
    prisma.province.findMany(),
  ]);

  const lookup = buildProvinceLookup(provinces, regions);
  let upsertedCount = 0;
  const unmappedProvinces = new Set<string>();
  const contractorStats = new Map<string, { count: number; totalValue: number; totalProgress: number; overdueCount: number; terminatedCount: number }>();

  // Process in batches
  for (let i = 0; i < projects.length; i += SYNC_BATCH_SIZE) {
    const batch = projects.slice(i, i + SYNC_BATCH_SIZE);

    for (const p of batch) {
      const provinceId = lookup(p.location.province, p.location.region);
      if (!provinceId) {
        unmappedProvinces.add(`${p.location.province} (${p.location.region})`);
        continue;
      }

      // Parse dates
      const startDate = new Date(p.startDate);
      const completionDate = p.completionDate ? new Date(p.completionDate) : null;

      if (isNaN(startDate.getTime())) continue;

      // Compute anomaly flags
      // Note: AgencyUpdate model removed in Phase 1 cleanup
      const latestUpdate = null;

      const commentCount = await prisma.comment.count({
        where: { projectId: p.contractId },
      });

      const flags = computeAnomalyFlags(
        {
          status: p.status,
          progress: p.progress,
          startDate,
          completionDate,
          amountPaid: p.amountPaid,
          budgetPHP: p.budget,
        },
        latestUpdate,
        commentCount
      );

      try {
        await prisma.project.upsert({
          where: { id: p.contractId },
          update: {
            name: p.description,
            provinceId,
            gpsLat: p.latitude,
            gpsLng: p.longitude,
            budgetPHP: p.budget,
            amountPaid: p.amountPaid,
            progress: p.progress,
            startDate,
            completionDate,
            status: p.status,
            category: p.category,
            contractorRaw: p.contractor,
            sourceOfFunds: p.sourceOfFunds,
            programName: p.programName,
            infraYear: p.infraYear,
            hasSatelliteImage: p.hasSatelliteImage,
            reportCount: p.reportCount,
            syncSource: source,
            ...flags,
          },
          create: {
            id: p.contractId,
            name: p.description,
            provinceId,
            gpsLat: p.latitude,
            gpsLng: p.longitude,
            budgetPHP: p.budget,
            amountPaid: p.amountPaid,
            progress: p.progress,
            startDate,
            completionDate,
            status: p.status,
            category: p.category,
            contractorRaw: p.contractor,
            sourceOfFunds: p.sourceOfFunds,
            programName: p.programName,
            infraYear: p.infraYear,
            hasSatelliteImage: p.hasSatelliteImage,
            reportCount: p.reportCount,
            syncSource: source,
            ...flags,
          },
        });
        upsertedCount++;
      } catch (err) {
        console.error(`Failed to upsert project ${p.contractId}:`, err);
      }

      // Track contractor stats
      const contractorNames = parseContractors(p.contractor);
      for (const name of contractorNames) {
        const cleaned = cleanContractorName(name);
        const existing = contractorStats.get(cleaned) ?? { count: 0, totalValue: 0, totalProgress: 0, overdueCount: 0, terminatedCount: 0 };
        existing.count++;
        existing.totalValue += p.budget;
        existing.totalProgress += p.progress;
        if (flags.flagOverdue) existing.overdueCount++;
        if (p.status === 'Terminated') existing.terminatedCount++;
        contractorStats.set(cleaned, existing);
      }
    }
  }

  // Update contractor table
  for (const [name, stats] of contractorStats) {
    try {
      await prisma.contractor.upsert({
        where: { name },
        update: {
          totalContracts: stats.count,
          totalValuePHP: stats.totalValue,
          avgProgress: stats.count > 0 ? stats.totalProgress / stats.count : 0,
          overdueCount: stats.overdueCount,
          terminatedCount: stats.terminatedCount,
        },
        create: {
          name,
          totalContracts: stats.count,
          totalValuePHP: stats.totalValue,
          avgProgress: stats.count > 0 ? stats.totalProgress / stats.count : 0,
          overdueCount: stats.overdueCount,
          terminatedCount: stats.terminatedCount,
        },
      });
    } catch (err) {
      console.error(`Failed to upsert contractor ${name}:`, err);
    }
  }

  if (unmappedProvinces.size > 0) {
    console.warn('Unmapped provinces:', Array.from(unmappedProvinces));
  }

  return upsertedCount;
}

export async function POST(request: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET()}`) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting nightly sync...');

    // Try DPWH API first, fall back to HuggingFace
    let projects = await fetchFromDPWH();
    let source = 'dpwh';

    if (!projects) {
      console.log('DPWH API failed, falling back to HuggingFace...');
      projects = await fetchFromHuggingFace();
      source = 'huggingface';
    }

    if (!projects) {
      await prisma.syncLog.create({
        data: { source: 'none', count: 0, success: false, error: 'Both DPWH and HuggingFace APIs failed' },
      });
      return Response.json(
        { error: 'Both data sources failed', source: 'none' },
        { status: 502 }
      );
    }

    console.log(`Fetched ${projects.length} projects from ${source}`);

    const upsertedCount = await upsertProjects(projects, source);

    await prisma.syncLog.create({
      data: { source, count: upsertedCount, success: true },
    });

    console.log(`Sync complete: ${upsertedCount} projects upserted from ${source}`);

    return Response.json({
      success: true,
      source,
      total: projects.length,
      upserted: upsertedCount,
    });
  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await prisma.syncLog.create({
      data: { source: 'error', count: 0, success: false, error: errorMessage },
    }).catch(() => {});
    return Response.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}
