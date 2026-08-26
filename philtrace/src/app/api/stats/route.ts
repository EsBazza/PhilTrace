import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const regions = await prisma.region.findMany({
      include: {
        provinces: {
          include: {
            _count: { select: { projects: true } },
          },
        },
      },
    });

    const regionStats = await Promise.all(
      regions.map(async (region) => {
        const totalProjects = region.provinces.reduce(
          (sum, p) => sum + p._count.projects,
          0
        );

        const [flaggedProjects, budgetResult] = await Promise.all([
          prisma.project.count({
            where: {
              province: { regionId: region.id },
              OR: [
                { flagStalled: true },
                { flagNeverStarted: true },
                { flagOverdue: true },
                { flagOverpaid: true },
              ],
            },
          }),
          prisma.project.aggregate({
            where: { province: { regionId: region.id } },
            _sum: { budgetPHP: true },
          }),
        ]);

        return {
          name: region.name,
          totalProjects,
          flaggedProjects,
          totalBudget: budgetResult._sum.budgetPHP ?? 0,
          anomalyDensity: totalProjects > 0 ? flaggedProjects / totalProjects : 0,
        };
      })
    );

    // Sort by anomaly density descending
    regionStats.sort((a, b) => b.anomalyDensity - a.anomalyDensity);

    const totalContracts = regionStats.reduce((sum, r) => sum + r.totalProjects, 0);
    const totalBudget = regionStats.reduce((sum, r) => sum + r.totalBudget, 0);

    const lastProject = await prisma.project.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    return Response.json({
      regions: regionStats,
      totalContracts,
      totalBudget,
      lastSync: lastProject?.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return Response.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
