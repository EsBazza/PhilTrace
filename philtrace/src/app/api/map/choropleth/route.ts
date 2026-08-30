import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

interface ChoroplethItem {
  psgcCode: string;
  name: string;
  projectCount: number;
  totalBudgetPHP: number;
  flaggedCount: number;
  avgProgress: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const level = searchParams.get('level') === 'region' ? 'region' : 'province';
    const regionId = searchParams.get('regionId');
    const provinceId = searchParams.get('provinceId');

    const projectWhere: Prisma.ProjectWhereInput = {};
    const provinceWhere: Prisma.ProvinceWhereInput = {};

    if (provinceId) {
      projectWhere.provinceId = provinceId;
      provinceWhere.id = provinceId;
    }
    if (regionId) {
      provinceWhere.regionId = regionId;
    }

    if (regionId && !provinceId) {
      const provincesInRegion = await prisma.province.findMany({
        where: { regionId },
        select: { id: true },
      });
      projectWhere.provinceId = { in: provincesInRegion.map(p => p.id) };
    }

    // Aggregate project stats by province
    const allStats = await prisma.project.groupBy({
      by: ['provinceId'],
      _count: { id: true },
      _sum: { budgetPHP: true },
      _avg: { progress: true },
      where: projectWhere,
    });

    // Count flagged projects by province
    const flaggedStats = await prisma.project.groupBy({
      by: ['provinceId'],
      _count: { id: true },
      where: {
        ...projectWhere,
        OR: [
          { flagStalled: true },
          { flagNeverStarted: true },
          { flagOverdue: true },
          { flagOverpaid: true },
        ],
      },
    });

    const flaggedMap = new Map<string, number>();
    flaggedStats.forEach(stat => flaggedMap.set(stat.provinceId, stat._count.id));

    const provinces = await prisma.province.findMany({
      where: provinceWhere,
      include: { region: true },
    });

    const provinceMap = new Map<string, typeof provinces[0]>();
    provinces.forEach(p => provinceMap.set(p.id, p));

    if (level === 'province') {
      const data: ChoroplethItem[] = allStats
        .filter(stat => provinceMap.has(stat.provinceId))
        .map(stat => {
          const prov = provinceMap.get(stat.provinceId)!;
          return {
            psgcCode: prov.psgcCode,
            name: prov.name,
            projectCount: stat._count.id,
            totalBudgetPHP: stat._sum.budgetPHP || 0,
            avgProgress: stat._avg.progress || 0,
            flaggedCount: flaggedMap.get(stat.provinceId) || 0,
          };
        });
      return Response.json({ data });
    } else {
      // Aggregate up to region level
      const regionAggMap = new Map<string, {
        psgcCode: string;
        name: string;
        projectCount: number;
        totalBudgetPHP: number;
        flaggedCount: number;
        sumProgress: number;
      }>();

      allStats.forEach(stat => {
        const prov = provinceMap.get(stat.provinceId);
        if (!prov) return;
        const reg = prov.region;

        if (!regionAggMap.has(reg.id)) {
          regionAggMap.set(reg.id, {
            psgcCode: reg.psgcCode,
            name: reg.name,
            projectCount: 0,
            totalBudgetPHP: 0,
            flaggedCount: 0,
            sumProgress: 0,
          });
        }

        const agg = regionAggMap.get(reg.id)!;
        agg.projectCount += stat._count.id;
        agg.totalBudgetPHP += (stat._sum.budgetPHP || 0);
        agg.sumProgress += (stat._avg.progress || 0) * stat._count.id;
        agg.flaggedCount += (flaggedMap.get(stat.provinceId) || 0);
      });

      const data: ChoroplethItem[] = Array.from(regionAggMap.values()).map(agg => ({
        psgcCode: agg.psgcCode,
        name: agg.name,
        projectCount: agg.projectCount,
        totalBudgetPHP: agg.totalBudgetPHP,
        avgProgress: agg.projectCount > 0 ? agg.sumProgress / agg.projectCount : 0,
        flaggedCount: agg.flaggedCount,
      }));

      return Response.json({ data });
    }
  } catch (error) {
    console.error('Error fetching choropleth data:', error);
    return Response.json({ error: 'Failed to fetch choropleth data' }, { status: 500 });
  }
}
