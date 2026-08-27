import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const regions = await prisma.region.findMany({
      include: {
        provinces: {
          select: { id: true, name: true, psgcCode: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return Response.json({
      regions,
    });
  } catch (error) {
    console.error('Error fetching location hierarchy:', error);
    return Response.json({ error: 'Failed to fetch location hierarchy' }, { status: 500 });
  }
}
