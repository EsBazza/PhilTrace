import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find contractor by ID or by Name
    let contractor = await prisma.contractor.findUnique({
      where: { id },
      include: {
        connections: {
          where: { confidence: 'REPORTED' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!contractor) {
      contractor = await prisma.contractor.findFirst({
        where: { name: { contains: id, mode: 'insensitive' } },
        include: {
          connections: {
            where: { confidence: 'REPORTED' },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    if (!contractor) {
      return Response.json(
        { error: 'Contractor not found' },
        { status: 404 }
      );
    }

    return Response.json({
      contractorId: contractor.id,
      contractorName: contractor.name,
      disclaimer: 'PhilTrace presents verified journalistic and congressional mentions with source citations for public transparency. These citations do not represent legal accusations or official findings by PhilTrace.',
      connections: contractor.connections.map((c) => ({
        id: c.id,
        connectedName: c.connectedName,
        connectionType: c.connectionType,
        sourceLabel: c.sourceLabel,
        sourceUrl: c.sourceUrl,
        confidence: c.confidence,
        displayText: `Mentioned in ${c.sourceLabel}`,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching contractor connections:', error);
    return Response.json(
      { error: 'Failed to fetch contractor connections' },
      { status: 500 }
    );
  }
}
