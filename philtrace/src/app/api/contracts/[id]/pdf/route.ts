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
        engineerSignature: true,
        project: {
          select: {
            id: true,
            name: true,
            budgetPHP: true,
            contractorRaw: true,
          },
        },
      },
    });

    if (!contractDoc) {
      return Response.json(
        {
          projectId: id,
          extractionStatus: 'PENDING',
          message: 'Contract document not yet parsed for this project.',
        },
        { status: 404 }
      );
    }

    return Response.json({ contractDocument: contractDoc });
  } catch (error) {
    console.error('Error fetching contract PDF data:', error);
    return Response.json(
      { error: 'Failed to fetch contract document' },
      { status: 500 }
    );
  }
}
