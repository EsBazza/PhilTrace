import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testPrecisionNormalizer() {
  const provinces = await prisma.province.findMany({
    include: { region: true }
  });

  console.log(`Loaded ${provinces.length} provinces from DB.`);

  // Find sample regional-level projects that got assigned to Aurora
  const sample = await prisma.project.findMany({
    where: {
      province: { name: "Aurora" },
      name: { contains: "PAMPANGA", mode: 'insensitive' }
    },
    select: { id: true, name: true },
    take: 10
  });

  console.log(`Found ${sample.length} projects in Aurora that actually mention Pampanga:`);
  for (const s of sample) {
    console.log(`- [${s.id}] ${s.name.slice(0, 80)}...`);
  }
}

testPrecisionNormalizer()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
