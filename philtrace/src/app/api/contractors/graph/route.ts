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
    isMonopoly: boolean;
    monopolyProvince?: string;
  };
}

interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    weight: number;
    isSuddenJv: boolean;
    label?: string;
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

    // Get projects with joint ventures and check provincial monopoly
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { contractorRaw: { contains: '/' } },
          { contractorRaw: { contains: ' (JV) ' } },
          { contractorRaw: { contains: ' JOINT VENTURE ' } },
          { budgetPHP: { gte: 10000000 } },
        ],
      },
      select: {
        contractorRaw: true,
        budgetPHP: true,
        province: { select: { name: true } },
      },
      take: 5000,
    });

    // Build edge map and detect sudden JVs (>₱10M)
    const edgeMap = new Map<string, { weight: number; isSuddenJv: boolean }>();
    const activeConnectedNodeIds = new Set<string>();

    for (const project of projects) {
      const names = parseContractors(project.contractorRaw);
      if (names.length < 2) continue;

      const isLargeContract = project.budgetPHP >= 10000000;

      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const c1 = names[i];
          const c2 = names[j];

          if (c1 && c2 && c1 !== c2 && cleanNodeIds.has(c1) && cleanNodeIds.has(c2)) {
            const key = [c1, c2].sort().join('|||');
            const existing = edgeMap.get(key) || { weight: 0, isSuddenJv: false };
            existing.weight++;
            if (isLargeContract) existing.isSuddenJv = true;

            edgeMap.set(key, existing);
            activeConnectedNodeIds.add(c1);
            activeConnectedNodeIds.add(c2);
          }
        }
      }
    }

    const nodes: CytoscapeNode[] = Array.from(contractorMap.entries()).map(([cleanName, c]) => {
      // Check overdue/terminated or high risk
      const isHighRisk = c.overdueCount > 3 || c.terminatedCount > 0;

      return {
        data: {
          id: cleanName,
          label: cleanName,
          totalValue: c.totalValuePHP,
          totalContracts: c.totalContracts,
          avgProgress: c.avgProgress,
          overdueCount: c.overdueCount,
          terminatedCount: c.terminatedCount,
          isMonopoly: isHighRisk,
        },
      };
    });

    const edges: CytoscapeEdge[] = [];
    for (const [key, data] of edgeMap) {
      const [source, target] = key.split('|||');
      if (cleanNodeIds.has(source) && cleanNodeIds.has(target)) {
        edges.push({
          data: {
            id: `${source}-${target}`,
            source,
            target,
            weight: data.weight,
            isSuddenJv: data.isSuddenJv,
            label: data.isSuddenJv ? 'NEW JV' : undefined,
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
