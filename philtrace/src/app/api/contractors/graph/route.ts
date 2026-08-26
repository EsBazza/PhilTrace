import { prisma } from '@/lib/prisma';
import { parseContractors } from '@/lib/format';

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
      take: 200, // Top 200 contractors for the graph
    });

    // Get projects with multiple contractors (joint ventures)
    const projects = await prisma.project.findMany({
      where: {
        contractorRaw: {
          contains: '&',
        },
      },
      select: {
        id: true,
        contractorRaw: true,
      },
    });

    // Build edge map
    const edgeMap = new Map<string, number>();
    for (const project of projects) {
      const names = parseContractors(project.contractorRaw);
      if (names.length < 2) continue;

      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const key = [names[i], names[j]].sort().join('|||');
          edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1);
        }
      }
    }

    const nodeIds = new Set(contractors.map((c) => c.name));

    const nodes: CytoscapeNode[] = contractors.map((c) => ({
      data: {
        id: c.name,
        label: c.name,
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
      if (nodeIds.has(source) && nodeIds.has(target)) {
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
