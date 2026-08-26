import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

interface AgencyPayload {
  id: string;
  email: string;
  agencyName: string;
}

interface UpdateBody {
  projectId: string;
  percentDone: number;
  note: string;
  photoUrl?: string;
}

function getAgencyFromCookie(request: NextRequest): AgencyPayload | null {
  const cookie = request.cookies.get('agency_token');
  if (!cookie) return null;

  try {
    return jwt.verify(cookie.value, env.JWT_SECRET()) as AgencyPayload;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return Response.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const updates = await prisma.agencyUpdate.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return Response.json({ updates });
  } catch (error) {
    console.error('Error fetching agency updates:', error);
    return Response.json(
      { error: 'Failed to fetch agency updates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const agency = getAgencyFromCookie(request);
    if (!agency) {
      return Response.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const body = await request.json() as UpdateBody;
    const { projectId, percentDone, note, photoUrl } = body;

    if (!projectId || percentDone === undefined || !note) {
      return Response.json(
        { error: 'projectId, percentDone, and note are required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return Response.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const update = await prisma.agencyUpdate.create({
      data: {
        projectId,
        agencyName: agency.agencyName,
        percentDone,
        note,
        photoUrl: photoUrl ?? null,
      },
    });

    // Update project's lastActivityAt
    await prisma.project.update({
      where: { id: projectId },
      data: { lastActivityAt: new Date() },
    });

    return Response.json({ update }, { status: 201 });
  } catch (error) {
    console.error('Error creating agency update:', error);
    return Response.json(
      { error: 'Failed to create agency update' },
      { status: 500 }
    );
  }
}
