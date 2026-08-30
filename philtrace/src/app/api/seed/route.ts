import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { computeAnomalyFlags } from '@/lib/anomaly-flags';
import { buildProvinceLookup } from '@/lib/province-normalizer';
import { cleanContractorName, parseContractors } from '@/lib/format';
import { HF_DATASET_API, HF_DATASET_NAME, SYNC_DELAY_MS } from '@/lib/constants';

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

    // Check if already seeded
    const existingCount = await prisma.project.count();
    if (existingCount > 1000) {
      return Response.json({
        message: `Database already has ${existingCount} projects. Skipping seed.`,
        skipped: true,
      });
    }

    // Load province lookup
    const [regions, provinces] = await Promise.all([
      prisma.region.findMany(),
      prisma.province.findMany(),
    ]);

    if (provinces.length === 0) {
      return Response.json(
        { error: 'No provinces found. Run /api/psgc/populate first.' },
        { status: 400 }
      );
    }

    const lookup = buildProvinceLookup(provinces, regions);

    let offset = 0;
    const length = 100;
    let totalRows = Infinity;
    let upsertedCount = 0;
    let skippedCount = 0;
    const contractorStats = new Map<string, { count: number; totalValue: number; totalProgress: number; overdueCount: number; terminatedCount: number }>();

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

      for (const { row: p } of data.rows) {
        const provinceId = lookup(p.location.province, p.location.region);
        if (!provinceId) {
          skippedCount++;
          continue;
        }

        const startDate = new Date(p.startDate);
        const completionDate = p.completionDate ? new Date(p.completionDate) : null;
        if (isNaN(startDate.getTime())) {
          skippedCount++;
          continue;
        }

        const flags = computeAnomalyFlags(
          {
            status: p.status,
            progress: p.progress,
            startDate,
            completionDate,
            amountPaid: p.amountPaid,
            budgetPHP: p.budget,
          },
          null,
          0
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
              syncSource: 'huggingface',
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
              syncSource: 'huggingface',
              ...flags,
            },
          });
          upsertedCount++;

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
        } catch (err) {
          console.error(`Failed to upsert ${p.contractId}:`, err);
          skippedCount++;
        }
      }

      offset += length;
      await new Promise((resolve) => setTimeout(resolve, SYNC_DELAY_MS));

      if (offset % 10000 === 0) {
        console.log(`Seed progress: ${offset}/${totalRows} (${upsertedCount} upserted, ${skippedCount} skipped)`);
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

    await prisma.syncLog.create({
      data: { source: 'huggingface-seed', count: upsertedCount, success: true },
    });

    return Response.json({
      success: true,
      totalRows,
      upserted: upsertedCount,
      skipped: skippedCount,
      contractors: contractorStats.size,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return Response.json(
      { error: 'Seed failed' },
      { status: 500 }
    );
  }
}
