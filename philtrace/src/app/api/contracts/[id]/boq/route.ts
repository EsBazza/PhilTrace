import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const contractDoc = await prisma.contractDocument.findUnique({
      where: { projectId: id },
      include: {
        billOfQuantities: true,
        project: {
          select: {
            id: true,
            name: true,
            budgetPHP: true,
            provinceId: true,
            province: {
              select: { regionId: true },
            },
          },
        },
      },
    });

    if (!contractDoc) {
      return Response.json(
        {
          projectId: id,
          extractionStatus: 'PENDING',
          items: [],
          message: 'No bill of quantities extracted yet.',
        },
        { status: 404 }
      );
    }

    const regionId = contractDoc.project?.province?.regionId;

    // Fetch benchmarks for comparison
    const itemCodes = contractDoc.billOfQuantities.map((item) => item.itemCode);
    const benchmarks = await prisma.unitPriceBenchmark.findMany({
      where: {
        itemCode: { in: itemCodes },
        OR: [{ regionId: null }, { regionId: regionId ?? undefined }],
      },
    });

    const benchmarkMap = new Map<string, { nationalAvgPhp: number; regionalAvgPhp: number | null }>();
    benchmarks.forEach((b) => {
      const existing = benchmarkMap.get(b.itemCode) || { nationalAvgPhp: b.nationalAvgPhp, regionalAvgPhp: null };
      if (b.regionalAvgPhp) existing.regionalAvgPhp = b.regionalAvgPhp;
      benchmarkMap.set(b.itemCode, existing);
    });

    // Check mobilization inflated flag (Item B.9 > 5% of total budget)
    let totalBoqCost = 0;
    let mobilizationCost = 0;

    const itemsWithVariance = contractDoc.billOfQuantities.map((item) => {
      totalBoqCost += item.totalPhp;
      if (item.itemCode.toUpperCase().includes('B.9') || item.description.toLowerCase().includes('mobilization')) {
        mobilizationCost += item.totalPhp;
      }

      const bm = benchmarkMap.get(item.itemCode);
      const nationalAvg = bm?.nationalAvgPhp ?? null;
      const variancePct = nationalAvg ? ((item.unitCostPhp - nationalAvg) / nationalAvg) * 100 : null;
      const isAnomalous = variancePct !== null && variancePct >= 30;

      return {
        id: item.id,
        itemCode: item.itemCode,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitCostPhp: item.unitCostPhp,
        totalPhp: item.totalPhp,
        nationalAvgPhp: nationalAvg,
        regionalAvgPhp: bm?.regionalAvgPhp ?? null,
        variancePct: variancePct !== null ? Math.round(variancePct * 10) / 10 : null,
        flagUnitPriceAnomaly: isAnomalous,
      };
    });

    const contractBudget = contractDoc.project?.budgetPHP || totalBoqCost;
    const flagMobilizationInflated = contractBudget > 0 && (mobilizationCost / contractBudget) > 0.05;

    return Response.json({
      projectId: id,
      extractionStatus: contractDoc.extractionStatus,
      totalBoqCost,
      mobilizationCost,
      flagMobilizationInflated,
      items: itemsWithVariance,
    });
  } catch (error) {
    console.error('Error fetching BOQ data:', error);
    return Response.json(
      { error: 'Failed to fetch bill of quantities' },
      { status: 500 }
    );
  }
}
