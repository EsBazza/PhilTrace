import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveProvinceAndRegion } from '@/lib/geo-spatial';
import { cleanProjectTitle } from '@/lib/title-cleaner';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        province: {
          include: { region: true },
        },
        comments: {
          where: { phoneVerified: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      return Response.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // SPATIAL OVERRIDE: If the project's GPS coordinates resolve to a real province/region,
    // override the inaccurate DB province relation (e.g. Candaba in Pampanga vs NCR).
    let resolvedProvince = project.province?.name;
    let resolvedRegion = project.province?.region?.name;

    if (project.gpsLng && project.gpsLat) {
      const spatial = resolveProvinceAndRegion(project.gpsLng, project.gpsLat);
      if (spatial) {
        resolvedProvince = spatial.province;
        resolvedRegion = spatial.region;
      }
    }

    const cleanedName = cleanProjectTitle(project.name);

    const enrichedProject = {
      ...project,
      name: cleanedName,
      rawName: project.name,
      province: {
        id: project.province?.id || '',
        name: resolvedProvince || project.province?.name || '',
        region: {
          id: project.province?.region?.id || '',
          name: resolvedRegion || project.province?.region?.name || '',
        },
      },
    };

    return Response.json(enrichedProject);
  } catch (error) {
    console.error('Error fetching project:', error);
    return Response.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}
