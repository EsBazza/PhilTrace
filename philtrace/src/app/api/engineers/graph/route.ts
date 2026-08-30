import { prisma } from '@/lib/prisma';
import { cleanContractorName } from '@/lib/format';

interface CytoscapeNode {
  data: {
    id: string;
    label: string;
    type: 'engineer' | 'contractor';
    district?: string;
    totalContracts: number;
    flagColor: string;
  };
}

interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    weight: number;
    hasRisk: boolean;
  };
}

export async function GET() {
  try {
    // Fetch engineer signatures with contract doc and project details
    const signatures = await prisma.engineerSignature.findMany({
      include: {
        contractDoc: {
          include: {
            project: {
              select: {
                id: true,
                contractorRaw: true,
                flagStalled: true,
                flagOverpaid: true,
                flagOverdue: true,
                budgetPHP: true,
              },
            },
          },
        },
      },
      take: 2000,
    });

    const engineerMap = new Map<string, {
      name: string;
      district: string;
      contractCount: number;
      hasStalledOrOverpaid: boolean;
    }>();

    const contractorMap = new Map<string, {
      name: string;
      contractCount: number;
      hasStalledOrOverpaid: boolean;
    }>();

    const edgeMap = new Map<string, { weight: number; hasRisk: boolean }>();

    for (const sig of signatures) {
      const engName = sig.engineerName.trim();
      if (!engName) continue;

      const project = sig.contractDoc?.project;
      const contractorName = project ? cleanContractorName(project.contractorRaw) : null;
      if (!contractorName) continue;

      const isHighRisk = Boolean(project?.flagStalled || project?.flagOverpaid);

      // Track engineer
      const eng = engineerMap.get(engName) || {
        name: engName,
        district: sig.district || 'District Office',
        contractCount: 0,
        hasStalledOrOverpaid: false,
      };
      eng.contractCount++;
      if (isHighRisk) eng.hasStalledOrOverpaid = true;
      engineerMap.set(engName, eng);

      // Track contractor
      const cont = contractorMap.get(contractorName) || {
        name: contractorName,
        contractCount: 0,
        hasStalledOrOverpaid: false,
      };
      cont.contractCount++;
      if (isHighRisk) cont.hasStalledOrOverpaid = true;
      contractorMap.set(contractorName, cont);

      // Track pair edge
      const edgeKey = `${engName}|||${contractorName}`;
      const edge = edgeMap.get(edgeKey) || { weight: 0, hasRisk: false };
      edge.weight++;
      if (isHighRisk) edge.hasRisk = true;
      edgeMap.set(edgeKey, edge);
    }

    const nodes: CytoscapeNode[] = [];

    // Engineer nodes
    engineerMap.forEach((eng, name) => {
      let flagColor = '#3b82f6'; // Blue
      if (eng.hasStalledOrOverpaid) {
        flagColor = '#ef4444'; // Red
      } else if (eng.contractCount >= 5) {
        flagColor = '#f59e0b'; // Amber
      }

      nodes.push({
        data: {
          id: `eng-${name}`,
          label: name,
          type: 'engineer',
          district: eng.district,
          totalContracts: eng.contractCount,
          flagColor,
        },
      });
    });

    // Contractor nodes
    contractorMap.forEach((cont, name) => {
      let flagColor = '#10b981'; // Green
      if (cont.hasStalledOrOverpaid) {
        flagColor = '#ef4444'; // Red
      }

      nodes.push({
        data: {
          id: `cont-${name}`,
          label: name,
          type: 'contractor',
          totalContracts: cont.contractCount,
          flagColor,
        },
      });
    });

    const edges: CytoscapeEdge[] = [];
    edgeMap.forEach((data, key) => {
      const [engName, contName] = key.split('|||');
      edges.push({
        data: {
          id: `e-${engName}-${contName}`,
          source: `eng-${engName}`,
          target: `cont-${contName}`,
          weight: data.weight,
          hasRisk: data.hasRisk,
        },
      });
    });

    return Response.json({ nodes, edges });
  } catch (error) {
    console.error('Error fetching engineer graph:', error);
    return Response.json(
      { error: 'Failed to fetch engineer signature graph' },
      { status: 500 }
    );
  }
}
