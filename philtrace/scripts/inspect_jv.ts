import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function inspectJvStrings() {
  const sample = await prisma.project.findMany({
    where: {
      OR: [
        { contractorRaw: { contains: '/' } },
        { contractorRaw: { contains: ' / ' } },
        { contractorRaw: { contains: 'JOINT VENTURE' } },
        { contractorRaw: { contains: '(JV)' } },
        { contractorRaw: { contains: ' JV ' } },
      ]
    },
    select: { contractorRaw: true },
    take: 15
  });

  console.log("Sample JV contractor strings in DPWH:");
  for (const s of sample) {
    console.log(`- "${s.contractorRaw}"`);
  }
}

inspectJvStrings()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
