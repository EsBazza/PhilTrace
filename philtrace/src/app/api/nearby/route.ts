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

    // Bounding Box Pre-Filter: drastically speeds up queries on large datasets (240k+ rows)
    const latDelta = (radius + 2) / 110.574;
    const lngDelta = (radius + 2) / (111.32 * Math.cos((lat * Math.PI) / 180));
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    // Haversine formula with bounding box pre-filter
    const projects = await prisma.$queryRaw`
      SELECT 
        p.*,
        CAST(
          6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(${lat})) * cos(radians(p."gpsLat")) *
              cos(radians(p."gpsLng") - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(p."gpsLat"))
            ))
          ) AS FLOAT
        ) AS distance
      FROM "Project" p
      WHERE 
        p."gpsLat" BETWEEN ${minLat} AND ${maxLat}
        AND p."gpsLng" BETWEEN ${minLng} AND ${maxLng}
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
