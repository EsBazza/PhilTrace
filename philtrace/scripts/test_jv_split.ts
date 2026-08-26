import { PrismaClient } from '@prisma/client';
import { cleanContractorName } from '../src/lib/format';

const prisma = new PrismaClient();

function parseContractorsAccurate(raw: string): string[] {
  // DPWH JVs are separated by " / " or " (JV) " or " JOINT VENTURE "
  const parts = raw.split(/\s*(?:\/|\(JV\)|JOINT\s+VENTURE|\s+JV\s+)\s*/i);
  return parts.map(p => cleanContractorName(p.trim())).filter(p => p.length > 2);
}

async function testAccurateJv() {
  const projects = await prisma.project.findMany({
    where: {
      contractorRaw: { contains: '/' }
    },
    select: { contractorRaw: true },
    take: 5000,
  });

  const pairCounts = new Map<string, number>();
  const entityCounts = new Map<string, number>();

  for (const p of projects) {
    const list = parseContractorsAccurate(p.contractorRaw);
    if (list.length >= 2) {
      for (const name of list) {
        entityCounts.set(name, (entityCounts.get(name) || 0) + 1);
      }
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (list[i] !== list[j]) {
            const key = [list[i], list[j]].sort().join(' <--> ');
            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
          }
        }
      }
    }
  }

  console.log(`Discovered ${entityCounts.size} distinct JV contractors and ${pairCounts.size} unique JV partnership links!`);
  console.log(`Top 10 Joint Venture Alliances in the Philippines:`);
  const sortedPairs = Array.from(pairCounts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [pair, count] of sortedPairs.slice(0, 10)) {
    console.log(`- ${pair} (${count} shared government projects)`);
  }
}

testAccurateJv()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
