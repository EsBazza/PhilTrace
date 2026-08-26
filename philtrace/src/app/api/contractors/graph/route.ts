import { prisma } from '@/lib/prisma';
import { parseContractors, cleanContractorName } from '@/lib/format';

interface CytoscapeNode {
  data: {
    id: string;
    label: string;
    totalValue: number;
    totalContracts: number;
    avgProgress: number;
    overdueCount: number;
    terminatedCount: number;
  };
}

interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    weight: number;
  };
}

export async function GET() {
  try {
    const contractors = await prisma.contractor.findMany({
      orderBy: { totalValuePHP: 'desc' },
      take: 150,
    });

    const contractorMap = new Map<string, typeof contractors[0]>();
    for (const c of contractors) {
      const clean = cleanContractorName(c.name);
      contractorMap.set(clean, c);
    }

    const cleanNodeIds = new Set(contractorMap.keys());

    // Get projects with joint ventures
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { contractorRaw: { contains: '/' } },
          { contractorRaw: { contains: ' (JV) ' } },
          { contractorRaw: { contains: ' JOINT VENTURE ' } },
        ],
      },
      select: {
        contractorRaw: true,
      },
      take: 5000,
    });

    // Build edge map
    const edgeMap = new Map<string, number>();
    const activeConnectedNodeIds = new Set<string>();

    for (const project of projects) {
      const names = parseContractors(project.contractorRaw);
      if (names.length < 2) continue;

      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const c1 = names[i];
          const c2 = names[j];

          if (c1 && c2 && c1 !== c2 && cleanNodeIds.has(c1) && cleanNodeIds.has(c2)) {
            const key = [c1, c2].sort().join('|||');
            edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1);
            activeConnectedNodeIds.add(c1);
            activeConnectedNodeIds.add(c2);
          }
        }
      }
    }

    const nodes: CytoscapeNode[] = Array.from(contractorMap.entries()).map(([cleanName, c]) => ({
      data: {
        id: cleanName,
        label: cleanName,
        totalValue: c.totalValuePHP,
        totalContracts: c.totalContracts,
        avgProgress: c.avgProgress,
        overdueCount: c.overdueCount,
        terminatedCount: c.terminatedCount,
      },
    }));

    const edges: CytoscapeEdge[] = [];
    for (const [key, weight] of edgeMap) {
      const [source, target] = key.split('|||');
      if (cleanNodeIds.has(source) && cleanNodeIds.has(target)) {
        edges.push({
          data: {
            id: `${source}-${target}`,
            source,
            target,
            weight,
          },
        });
      }
    }

    return Response.json({ nodes, edges });
  } catch (error) {
    console.error('Error building contractor graph:', error);
    return Response.json(
      { error: 'Failed to build contractor graph' },
      { status: 500 }
    );
  }
}
