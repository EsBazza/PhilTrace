import { PrismaClient } from '@prisma/client';
import { computeAnomalyFlags } from '../src/lib/anomaly-flags';

const prisma = new PrismaClient();

async function main() {
  console.log('Ingesting verified DPWH contract 24CD0103...');

  // 1. Ensure Bulacan province exists
  const bulacan = await prisma.province.findFirst({
    where: { name: { contains: 'Bulacan', mode: 'insensitive' } },
  });

  if (!bulacan) {
    throw new Error('Bulacan province not found in database');
  }

  const contractId = '24CD0103';
  const name =
    'BANK IMPROVEMENT ALONG STA. MARIA RIVER AND ITS TRIBUTARIES, STA. 09+304 STA. 09+708 (SAN JOSE PATAG PULONG BUHANGIN SECTION), STA. MARIA, BULACAN';
  const category = 'Flood Control and Drainage';
  const status = 'Completed';
  const budget = 98916463.13;
  const amountPaid = 0;
  const progress = 100.0;
  const startDate = new Date('2024-03-18');
  const completionDate = new Date('2025-04-06');
  const contractorRaw = 'NEWBIG FOUR J CONSTRUCTION INC. (FORMERLY: FOUR J CONSTRUCTION) (15104)';
  const lat = 14.8427225;
  const lng = 120.9863753;
  const programName = 'Regular Infra';
  const sourceOfFunds = 'Regular Infra - GAA 2024 SSP';
  const infraYear = '2024';

  const anomaly = computeAnomalyFlags(
    {
      status,
      progress,
      startDate,
      completionDate,
      budgetPHP: budget,
      amountPaid,
    },
    null,
    0
  );

  const project = await prisma.project.upsert({
    where: { id: contractId },
    update: {
      name,
      category,
      status,
      budgetPHP: budget,
      amountPaid,
      progress,
      startDate,
      completionDate,
      gpsLat: lat,
      gpsLng: lng,
      contractorRaw,
      sourceOfFunds,
      programName,
      infraYear,
      hasSatelliteImage: true,
      flagStalled: anomaly.flagStalled,
      flagNeverStarted: anomaly.flagNeverStarted,
      flagOverdue: anomaly.flagOverdue,
      flagPaymentPending: anomaly.flagPaymentPending,
      flagOverpaid: anomaly.flagOverpaid,
      syncSource: 'dpwh_national_archive',
      provinceId: bulacan.id,
    },
    create: {
      id: contractId,
      name,
      category,
      status,
      budgetPHP: budget,
      amountPaid,
      progress,
      startDate,
      completionDate,
      gpsLat: lat,
      gpsLng: lng,
      contractorRaw,
      sourceOfFunds,
      programName,
      infraYear,
      hasSatelliteImage: true,
      reportCount: 0,
      flagStalled: anomaly.flagStalled,
      flagNeverStarted: anomaly.flagNeverStarted,
      flagOverdue: anomaly.flagOverdue,
      flagPaymentPending: anomaly.flagPaymentPending,
      flagOverpaid: anomaly.flagOverpaid,
      provinceId: bulacan.id,
      syncSource: 'dpwh_national_archive',
    },
  });

  console.log('Project upserted successfully:', project.id, project.name);

  // 2. Contractor upsert
  const contractorClean = 'NEWBIG FOUR J CONSTRUCTION INC.';
  const existingContractor = await prisma.contractor.findFirst({
    where: { name: { contains: 'NEWBIG FOUR J', mode: 'insensitive' } },
  });

  if (existingContractor) {
    await prisma.contractor.update({
      where: { id: existingContractor.id },
      data: {
        totalContracts: { increment: 1 },
        totalValuePHP: { increment: budget },
      },
    });
    console.log('Updated existing contractor:', existingContractor.name);
  } else {
    const newContractor = await prisma.contractor.create({
      data: {
        name: contractorClean,
        totalContracts: 1,
        totalValuePHP: budget,
        avgProgress: 100,
        overdueCount: 0,
        terminatedCount: 0,
      },
    });
    console.log('Created contractor:', newContractor.name);
  }

  // 3. ContractDocument with DPWH Civil Works Registry Source Link
  const docUrl = `https://www.dpwh.gov.ph/dpwh/business/procurement/civil-works/contract/${contractId}`;
  await prisma.contractDocument.upsert({
    where: { projectId: contractId },
    update: {
      sourcePdfUrl: docUrl,
      contractorLegalName: contractorClean,
      contractDurationDays: 384,
      extractionStatus: 'PARSED',
      parsedAt: new Date(),
    },
    create: {
      projectId: contractId,
      sourcePdfUrl: docUrl,
      contractorLegalName: contractorClean,
      contractDurationDays: 384,
      extractionStatus: 'PARSED',
      parsedAt: new Date(),
    },
  });
  console.log('Contract document attached.');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error ingesting contract:', err);
  process.exit(1);
});
