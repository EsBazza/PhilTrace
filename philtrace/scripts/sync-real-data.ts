import { PrismaClient } from '@prisma/client';
import { computeAnomalyFlags } from '../src/lib/anomaly-flags';
import { buildProvinceLookup } from '../src/lib/province-normalizer';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function syncRealData() {
  console.log('Connecting to database...');
  const allProvinces = await prisma.province.findMany();
  const allRegions = await prisma.region.findMany();
  const provinceLookup = buildProvinceLookup(allProvinces, allRegions);
  const defaultProvince = allProvinces[0];

  if (!defaultProvince) {
    console.error('No provinces found! Run init-db first.');
    return;
  }

  const mirrors = [
    'bettergovph/dpwh-transparency-data',
    'c4rv3r/dpwh-transparency-data',
    'TEMSY001/dpwh-transparency-data'
  ];

  let totalSynced = 0;
  console.log('Fetching real DPWH transparency data...');

  for (const mirror of mirrors) {
    try {
      const url = `https://datasets-server.huggingface.co/first-rows?dataset=${encodeURIComponent(mirror)}&config=default&split=train`;
      console.log(`Querying ${mirror}...`);
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      
      if (!res.ok) {
        console.log(`Failed to fetch from ${mirror} (${res.status})`);
        continue;
      }

      const data = await res.json();
      const rows = data.rows || [];
      console.log(`Received ${rows.length} real projects from ${mirror}. Processing...`);

      for (const item of rows) {
        const row = item.row;
        if (!row || !row.contractId) continue;

        const loc = row.location || {};
        const provinceStr = typeof loc === 'object' ? (loc.province || '') : String(loc);
        const regionStr = typeof loc === 'object' ? (loc.region || '') : '';
        const provinceId = provinceLookup(provinceStr, regionStr) || defaultProvince.id;

        const budget = Number(row.budget) || 0;
        const amountPaid = Number(row.amountPaid) || 0;
        const progress = Number(row.progress) || 0;

        let startDate = new Date();
        if (row.startDate) {
          const parsed = new Date(row.startDate);
          if (!isNaN(parsed.getTime())) startDate = parsed;
        }

        let completionDate: Date | null = null;
        if (row.completionDate) {
          const parsed = new Date(row.completionDate);
          if (!isNaN(parsed.getTime())) completionDate = parsed;
        }

        const anomaly = computeAnomalyFlags(
          {
            status: row.status || 'On-Going',
            progress,
            startDate,
            completionDate,
            budgetPHP: budget,
            amountPaid,
          },
          null,
          0
        );

        await prisma.project.upsert({
          where: { id: row.contractId },
          update: {
            name: row.description || 'DPWH Infrastructure Project',
            category: row.category || 'Roads',
            status: row.status || 'On-Going',
            budgetPHP: budget,
            amountPaid,
            progress,
            startDate,
            completionDate,
            gpsLat: Number(row.latitude) || 14.5995,
            gpsLng: Number(row.longitude) || 120.9842,
            contractorRaw: row.contractor || 'Unassigned Contractor',
            sourceOfFunds: row.sourceOfFunds || null,
            programName: row.programName || null,
            infraYear: row.infraYear ? String(row.infraYear) : null,
            hasSatelliteImage: Boolean(row.hasSatelliteImage),
            flagStalled: anomaly.flagStalled,
            flagNeverStarted: anomaly.flagNeverStarted,
            flagOverdue: anomaly.flagOverdue,
            flagPaymentPending: anomaly.flagPaymentPending,
            flagOverpaid: anomaly.flagOverpaid,
            syncSource: 'dpwh_real_dataset',
          },
          create: {
            id: row.contractId,
            name: row.description || 'DPWH Infrastructure Project',
            category: row.category || 'Roads',
            status: row.status || 'On-Going',
            budgetPHP: budget,
            amountPaid,
            progress,
            startDate,
            completionDate,
            gpsLat: Number(row.latitude) || 14.5995,
            gpsLng: Number(row.longitude) || 120.9842,
            contractorRaw: row.contractor || 'Unassigned Contractor',
            sourceOfFunds: row.sourceOfFunds || null,
            programName: row.programName || null,
            infraYear: row.infraYear ? String(row.infraYear) : null,
            hasSatelliteImage: Boolean(row.hasSatelliteImage),
            reportCount: 0,
            flagStalled: anomaly.flagStalled,
            flagNeverStarted: anomaly.flagNeverStarted,
            flagOverdue: anomaly.flagOverdue,
            flagPaymentPending: anomaly.flagPaymentPending,
            flagOverpaid: anomaly.flagOverpaid,
            provinceId,
            syncSource: 'dpwh_real_dataset',
          },
        });

        totalSynced++;
      }
      console.log(`Synced ${totalSynced} projects from mirror ${mirror}`);
    } catch (e: unknown) {
      console.log(`Error on mirror ${mirror}:`, (e as Error).message);
    }
  }

  console.log(`Aggregating Contractor metrics...`);
  const projects = await prisma.project.findMany({
    select: {
      contractorRaw: true,
      budgetPHP: true,
      progress: true,
      flagOverdue: true,
      status: true,
    },
  });

  const contractorMap = new Map<string, { count: number; totalVal: number; totalProg: number; overdue: number; terminated: number }>();
  for (const p of projects) {
    const raw = (p.contractorRaw || 'Unassigned Contractor').trim();
    if (!contractorMap.has(raw)) {
      contractorMap.set(raw, { count: 0, totalVal: 0, totalProg: 0, overdue: 0, terminated: 0 });
    }
    const c = contractorMap.get(raw)!;
    c.count++;
    c.totalVal += p.budgetPHP;
    c.totalProg += p.progress;
    if (p.flagOverdue) c.overdue++;
    if (p.status === 'Terminated') c.terminated++;
  }

  for (const [name, stats] of contractorMap.entries()) {
    const id = crypto.createHash('md5').update(name).digest('hex');
    await prisma.contractor.upsert({
      where: { name },
      update: {
        totalContracts: stats.count,
        totalValuePHP: stats.totalVal,
        avgProgress: stats.count > 0 ? stats.totalProg / stats.count : 0,
        overdueCount: stats.overdue,
        terminatedCount: stats.terminated,
      },
      create: {
        id,
        name,
        totalContracts: stats.count,
        totalValuePHP: stats.totalVal,
        avgProgress: stats.count > 0 ? stats.totalProg / stats.count : 0,
        overdueCount: stats.overdue,
        terminatedCount: stats.terminated,
      },
    });
  }

  const finalProjects = await prisma.project.count();
  const finalContractors = await prisma.contractor.count();

  console.log('====================================');
  console.log('REAL DATA SYNC COMPLETED SUCCESSFULLY!');
  console.log(`Total Real Projects in Database: ${finalProjects}`);
  console.log(`Total Real Contractors in Database: ${finalContractors}`);
  console.log('====================================');
}

syncRealData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
