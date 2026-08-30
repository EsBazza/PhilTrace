import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: string;
    name: string;
    budgetPHP: number;
    progress: number;
    status: string;
    category: string;
    flagOverdue: boolean;
    flagOverpaid: boolean;
    flagStalled: boolean;
    flagNeverStarted: boolean;
    contractorRaw: string;
    avgRating: number;
  };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const sw_lat = parseFloat(searchParams.get('sw_lat') ?? '');
    const sw_lng = parseFloat(searchParams.get('sw_lng') ?? '');
    const ne_lat = parseFloat(searchParams.get('ne_lat') ?? '');
    const ne_lng = parseFloat(searchParams.get('ne_lng') ?? '');

    if (isNaN(sw_lat) || isNaN(sw_lng) || isNaN(ne_lat) || isNaN(ne_lng)) {
      return Response.json(
        { error: 'Bounding box coordinates (sw_lat, sw_lng, ne_lat, ne_lng) are required' },
        { status: 400 }
      );
    }

    const regionId = searchParams.get('regionId');
    const provinceId = searchParams.get('provinceId');
    const limitParam = parseInt(searchParams.get('limit') ?? '500', 10);
    const limit = Math.min(Math.max(limitParam, 1), 2000);

    const where: Prisma.ProjectWhereInput = {
      gpsLat: { gte: sw_lat, lte: ne_lat },
      gpsLng: { gte: sw_lng, lte: ne_lng },
    };

    if (provinceId) {
      where.provinceId = provinceId;
    } else if (regionId) {
      const provinces = await prisma.province.findMany({
        where: { regionId },
        select: { id: true },
      });
      where.provinceId = { in: provinces.map(p => p.id) };
    }

    const projects = await prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        budgetPHP: true,
        progress: true,
        status: true,
        category: true,
        flagOverdue: true,
        flagOverpaid: true,
        flagStalled: true,
        flagNeverStarted: true,
        contractorRaw: true,
        avgRating: true,
        gpsLat: true,
        gpsLng: true,
      },
      take: limit,
    });

    const features: GeoJSONFeature[] = projects.map(p => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [p.gpsLng, p.gpsLat] as [number, number],
      },
      properties: {
        id: p.id,
        name: p.name,
        budgetPHP: p.budgetPHP,
        progress: p.progress,
        status: p.status,
        category: p.category,
        flagOverdue: p.flagOverdue,
        flagOverpaid: p.flagOverpaid,
        flagStalled: p.flagStalled,
        flagNeverStarted: p.flagNeverStarted,
        contractorRaw: p.contractorRaw,
        avgRating: p.avgRating,
      },
    }));

    const response: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching map clusters:', error);
    return Response.json({ error: 'Failed to fetch map clusters' }, { status: 500 });
  }
}
