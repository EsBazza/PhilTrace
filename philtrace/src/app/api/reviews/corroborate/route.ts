import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId } = body;

    if (!reviewId) {
      return Response.json({ error: 'reviewId is required' }, { status: 400 });
    }

    const review = await prisma.review.update({
      where: { id: reviewId },
      data: {
        corroborations: { increment: 1 },
      },
    });

    return Response.json({ success: true, corroborations: review.corroborations });
  } catch (error) {
    console.error('Error corroborating review:', error);
    return Response.json({ error: 'Failed to corroborate review' }, { status: 500 });
  }
}
