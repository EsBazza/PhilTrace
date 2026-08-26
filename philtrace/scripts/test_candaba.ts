import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testSearch() {
  const query = "candaba";
  console.log(`Searching for "${query}" in Project name, id, contractorRaw, or province...`);
  
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { id: { contains: query, mode: 'insensitive' } },
        { contractorRaw: { contains: query, mode: 'insensitive' } },
        { province: { name: { contains: query, mode: 'insensitive' } } },
      ]
    },
    include: { province: true },
    take: 5
  });

  console.log(`Found ${projects.length} matching projects:`);
  for (const p of projects) {
    console.log(`- [${p.id}] ${p.name} (${p.province.name}) - PHP ${p.budgetPHP}`);
  }
}

testSearch()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
