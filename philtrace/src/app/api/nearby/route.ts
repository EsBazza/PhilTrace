import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const lat = parseFloat(searchParams.get('lat') ?? '0');
    const lng = parseFloat(searchParams.get('lng') ?? '0');
    const radius = parseFloat(searchParams.get('radius') ?? '5');

    if (!lat || !lng) {
      return Response.json(
        { error: 'lat and lng are required' },
        { status: 400 }
      );
    }

    // Haversine formula in raw SQL for PostgreSQL
    const projects = await prisma.$queryRaw`
      SELECT 
        p.*,
        (
          6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(${lat})) * cos(radians(p."gpsLat")) *
              cos(radians(p."gpsLng") - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(p."gpsLat"))
            ))
          )
        ) AS distance
      FROM "Project" p
      WHERE 
        p."gpsLat" IS NOT NULL
        AND p."gpsLng" IS NOT NULL
        AND p."gpsLat" != 0
        AND p."gpsLng" != 0
        AND (
          6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(${lat})) * cos(radians(p."gpsLat")) *
              cos(radians(p."gpsLng") - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(p."gpsLat"))
            ))
          )
        ) <= ${radius}
      ORDER BY distance ASC
      LIMIT 200
    `;

    return Response.json({ projects });
  } catch (error) {
    console.error('Error fetching nearby projects:', error);
    return Response.json(
      { error: 'Failed to fetch nearby projects' },
      { status: 500 }
    );
  }
}
