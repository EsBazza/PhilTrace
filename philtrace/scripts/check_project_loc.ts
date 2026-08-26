import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const projects = await prisma.project.findMany({
    where: {
      name: { contains: "NATIONAL BUILDING PROGRAM-BUILDINGS AND OTHER STRUCTURES-MULTI-PURPOSE", mode: 'insensitive' }
    },
    include: {
      province: {
        include: { region: true }
      }
    },
    take: 5
  });

  console.log(`Found ${projects.length} matching projects:`);
  for (const p of projects) {
    console.log(`\nID: ${p.id}`);
    console.log(`Name: ${p.name}`);
    console.log(`Province: ${p.province?.name} (PSGC: ${p.province?.psgcCode})`);
    console.log(`Region: ${p.province?.region?.name} (PSGC: ${p.province?.region?.psgcCode})`);
    console.log(`GPS: [${p.gpsLat}, ${p.gpsLng}]`);
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
