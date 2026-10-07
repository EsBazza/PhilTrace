import { prisma } from '@/lib/prisma';
import { parseContractors, cleanContractorName } from '@/lib/format';

interface SigmaNode {
  id: string;
  label: string;
  nodeType: 'contractor' | 'project';
  color: string;
  size: number;
  // Contractor properties
  totalValue?: number;
  totalContracts?: number;
  overdueCount?: number;
  terminatedCount?: number;
  // Project properties
  budget?: number;
  progress?: number;
  status?: string;
  flags?: string[];
}

interface SigmaEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
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

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { budgetPHP: { gte: 30000000 } },
          { flagOverdue: true },
          { flagOverpaid: true },
          { progress: { lte: 10, not: 0 }, updatedAt: { lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } // Stalled proxy
        ],
      },
      select: {
        id: true,
        name: true,
        contractorRaw: true,
        budgetPHP: true,
        progress: true,
        status: true,
        flagOverdue: true,
        flagOverpaid: true,
      },
      take: 500,
    });

    const nodes: SigmaNode[] = [];
    const edges: SigmaEdge[] = [];
    const projectNodesAdded = new Set<string>();
    const contractorNodesAdded = new Set<string>();

    for (const project of projects) {
      const names = parseContractors(project.contractorRaw);
      let linked = false;
      
      for (const name of names) {
        if (cleanNodeIds.has(name)) {
          linked = true;
          // Add edge
          edges.push({
            id: `e_${name}_${project.id}`,
            source: name,
            target: project.id,
            weight: 1,
          });
          
          if (!contractorNodesAdded.has(name)) {
            const c = contractorMap.get(name)!;
            nodes.push({
              id: name,
              label: name,
              nodeType: 'contractor',
              color: '#3b82f6', // blue
              size: Math.max(5, Math.min(20, (c.totalValuePHP / 100000000) * 5)),
              totalValue: c.totalValuePHP,
              totalContracts: c.totalContracts,
              overdueCount: c.overdueCount,
              terminatedCount: c.terminatedCount,
            });
            contractorNodesAdded.add(name);
          }
        }
      }

      if (linked && !projectNodesAdded.has(project.id)) {
        const flags = [];
        if (project.flagOverdue) flags.push('Overdue');
        if (project.flagOverpaid) flags.push('Overpaid');

        nodes.push({
          id: project.id,
          label: project.name.substring(0, 30) + '...',
          nodeType: 'project',
          color: flags.length > 0 ? '#ef4444' : '#10b981', // red or green
          size: Math.max(3, Math.min(15, (project.budgetPHP / 30000000) * 5)),
          budget: project.budgetPHP,
          progress: project.progress,
          status: project.status,
          flags,
        });
        projectNodesAdded.add(project.id);
      }
    }

    // Add remaining contractors that might not have edges in this subset
    for (const [name, c] of contractorMap.entries()) {
      if (!contractorNodesAdded.has(name)) {
        nodes.push({
          id: name,
          label: name,
          nodeType: 'contractor',
          color: '#3b82f6',
          size: Math.max(5, Math.min(20, (c.totalValuePHP / 100000000) * 5)),
          totalValue: c.totalValuePHP,
          totalContracts: c.totalContracts,
          overdueCount: c.overdueCount,
          terminatedCount: c.terminatedCount,
        });
        contractorNodesAdded.add(name);
      }
    }

    return Response.json(
      { nodes, edges },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        },
      }
    );
  } catch (error) {
    console.error('Error building bipartite graph:', error);
    return Response.json(
      { error: 'Failed to build graph' },
      { status: 500 }
    );
  }
}
