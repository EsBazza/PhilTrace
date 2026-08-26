import { PrismaClient } from '@prisma/client';
import { cleanContractorName, parseContractors } from '../src/lib/format';

const prisma = new PrismaClient();

async function testGraphMatching() {
  const contractors = await prisma.contractor.findMany({
    orderBy: { totalValuePHP: 'desc' },
    take: 100,
  });

  // Map of cleaned name -> contractor data
  const contractorMap = new Map();
  for (const c of contractors) {
    const clean = cleanContractorName(c.name);
    contractorMap.set(clean, c);
  }

  const cleanNodeIds = new Set(contractorMap.keys());
  console.log(`Top 100 Clean Contractor Nodes loaded.`);

  // Find projects with multiple contractors
  const jvProjects = await prisma.project.findMany({
    where: {
      OR: [
        { contractorRaw: { contains: '&' } },
        { contractorRaw: { contains: '/' } },
        { contractorRaw: { contains: 'JV' } },
        { contractorRaw: { contains: 'JOINT VENTURE' } },
      ]
    },
    select: { contractorRaw: true },
    take: 2000,
  });

  console.log(`Found ${jvProjects.length} sample JV projects.`);

  const edgeMap = new Map();
  for (const p of jvProjects) {
    const names = parseContractors(p.contractorRaw);
    if (names.length < 2) continue;

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const c1 = cleanContractorName(names[i]);
        const c2 = cleanContractorName(names[j]);
        if (cleanNodeIds.has(c1) && cleanNodeIds.has(c2) && c1 !== c2) {
          const key = [c1, c2].sort().join('|||');
          edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
        }
      }
    }
  }

  console.log(`Successfully built ${edgeMap.size} joint-venture connection edges!`);
  for (const [k, v] of Array.from(edgeMap.entries()).slice(0, 5)) {
    console.log(`  - ${k.replace('|||', ' <--> ')} (${v} shared contracts)`);
  }
}

testGraphMatching()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
