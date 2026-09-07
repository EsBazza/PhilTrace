import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [rows, lastProject] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          regionId: string;
          name: string;
          totalProjects: number;
          totalBudget: number;
          flaggedProjects: number;
        }>
      >`
        SELECT 
          r.id AS "regionId",
          r.name AS "name",
          COUNT(p.id)::int AS "totalProjects",
          COALESCE(SUM(p."budgetPHP"), 0)::float AS "totalBudget",
          COUNT(CASE WHEN (p."flagStalled" = true OR p."flagNeverStarted" = true OR p."flagOverdue" = true OR p."flagOverpaid" = true) THEN 1 END)::int AS "flaggedProjects"
        FROM "Region" r
        LEFT JOIN "Province" pr ON pr."regionId" = r.id
        LEFT JOIN "Project" p ON p."provinceId" = pr.id
        GROUP BY r.id, r.name
      `,
      prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    const regionStats = (rows as Array<{ name: string; totalProjects: number; totalBudget: number; flaggedProjects: number }>).map((r) => {
      const totalProjects = Number(r.totalProjects) || 0;
      const flaggedProjects = Number(r.flaggedProjects) || 0;
      const totalBudget = Number(r.totalBudget) || 0;
      return {
        name: r.name,
        totalProjects,
        flaggedProjects,
        totalBudget,
        anomalyDensity: totalProjects > 0 ? flaggedProjects / totalProjects : 0,
      };
    });

    // Sort by anomaly density descending
    regionStats.sort((a: { anomalyDensity: number }, b: { anomalyDensity: number }) => b.anomalyDensity - a.anomalyDensity);

    const totalContracts = regionStats.reduce((sum: number, r: { totalProjects: number }) => sum + r.totalProjects, 0);
    const totalBudget = regionStats.reduce((sum: number, r: { totalBudget: number }) => sum + r.totalBudget, 0);

    return Response.json(
      {
        regions: regionStats,
        totalContracts,
        totalBudget,
        lastSync: lastProject?.updatedAt?.toISOString() ?? null,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching stats:', error);
    return Response.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
