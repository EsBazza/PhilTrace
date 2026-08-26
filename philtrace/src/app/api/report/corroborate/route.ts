import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { commentId } = await request.json() as { commentId: string };

    if (!commentId) {
      return Response.json(
        { error: 'commentId is required' },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { corroborationCount: { increment: 1 } },
    });

    return Response.json({ corroborationCount: comment.corroborationCount });
  } catch (error) {
    console.error('Error corroborating:', error);
    return Response.json(
      { error: 'Failed to corroborate report' },
      { status: 500 }
    );
  }
}
