import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    return Response.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return Response.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}
