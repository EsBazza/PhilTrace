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

// In-memory cache for nationwide overview queries to provide 0ms instant loading
let cachedNationwideGeoJSON: { data: GeoJSONFeatureCollection; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const sw_lat = parseFloat(searchParams.get('sw_lat') ?? '4.0');
    const sw_lng = parseFloat(searchParams.get('sw_lng') ?? '114.0');
    const ne_lat = parseFloat(searchParams.get('ne_lat') ?? '22.0');
    const ne_lng = parseFloat(searchParams.get('ne_lng') ?? '128.5');

    const region = searchParams.get('region');
    const province = searchParams.get('province');
    const regionId = searchParams.get('regionId');
    const provinceId = searchParams.get('provinceId');
    const flag = searchParams.get('flag');
    const category = searchParams.get('category');
    const limitParam = parseInt(searchParams.get('limit') ?? '2000', 10);
    const limit = Math.min(Math.max(limitParam, 100), 4000);

    const isNationwide =
      !region &&
      !province &&
      !regionId &&
      !provinceId &&
      (!flag || flag === 'All') &&
      (!category || category === 'All') &&
      (ne_lat - sw_lat) >= 8.0;

    // Fast-path: Return cached nationwide response if available
    if (isNationwide && cachedNationwideGeoJSON && (Date.now() - cachedNationwideGeoJSON.timestamp < CACHE_TTL_MS)) {
      return Response.json(cachedNationwideGeoJSON.data, {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      });
    }

    const baseWhere: Prisma.ProjectWhereInput = {
      gpsLat: { not: undefined },
      gpsLng: { not: undefined },
    };

    if (provinceId) {
      baseWhere.provinceId = provinceId;
    } else if (province) {
      const matchingProvinces = await prisma.province.findMany({
        where: { name: { contains: province, mode: 'insensitive' } },
        select: { id: true },
      });
      if (matchingProvinces.length > 0) {
        baseWhere.provinceId = { in: matchingProvinces.map((p: { id: string }) => p.id) };
      }
    } else if (regionId) {
      const provinces = await prisma.province.findMany({
        where: { regionId },
        select: { id: true },
      });
      baseWhere.provinceId = { in: provinces.map((p: { id: string }) => p.id) };
    } else if (region) {
      const regions = await prisma.region.findMany({
        where: {
          OR: [
            { name: { equals: region, mode: 'insensitive' } },
            { name: { contains: region, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      if (regions.length > 0) {
        const provinces = await prisma.province.findMany({
          where: { regionId: { in: regions.map((r: { id: string }) => r.id) } },
          select: { id: true },
        });
        baseWhere.provinceId = { in: provinces.map((p: { id: string }) => p.id) };
      }
    }

    if (flag && flag !== 'All') {
      switch (flag) {
        case 'stalled':
          baseWhere.flagStalled = true;
          break;
        case 'neverStarted':
          baseWhere.flagNeverStarted = true;
          break;
        case 'overdue':
          baseWhere.flagOverdue = true;
          break;
        case 'overpaid':
          baseWhere.flagOverpaid = true;
          break;
        case 'paymentPending':
          baseWhere.flagPaymentPending = true;
          break;
      }
    }

    if (category && category !== 'All') {
      baseWhere.category = { contains: category, mode: 'insensitive' };
    }

    let rawProjects: any[] = [];

    const selectFields = {
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
    };

    // If nationwide overview, query Luzon, Visayas, and Mindanao in parallel to guarantee 100% full-country distribution
    if (isNationwide || (ne_lat - sw_lat >= 6.0 && !province && !provinceId)) {
      const [luzonProjects, visayasProjects, mindanaoProjects] = await Promise.all([
        // Luzon (lat 12.5 - 22.0)
        prisma.project.findMany({
          where: {
            ...baseWhere,
            gpsLat: { gte: 12.5, lte: 22.0 },
            gpsLng: { gte: 114.0, lte: 128.5 },
          },
          select: selectFields,
          take: 1200,
        }),
        // Visayas (lat 9.5 - 12.5)
        prisma.project.findMany({
          where: {
            ...baseWhere,
            gpsLat: { gte: 9.5, lte: 12.5 },
            gpsLng: { gte: 114.0, lte: 128.5 },
          },
          select: selectFields,
          take: 1000,
        }),
        // Mindanao (lat 4.0 - 9.5)
        prisma.project.findMany({
          where: {
            ...baseWhere,
            gpsLat: { gte: 4.0, lte: 9.5 },
            gpsLng: { gte: 114.0, lte: 128.5 },
          },
          select: selectFields,
          take: 1000,
        }),
      ]);

      rawProjects = [...luzonProjects, ...visayasProjects, ...mindanaoProjects];
    } else {
      // Focused Viewport / City / Municipality / Province Query
      const where: Prisma.ProjectWhereInput = {
        ...baseWhere,
        gpsLat: { gte: sw_lat, lte: ne_lat },
        gpsLng: { gte: sw_lng, lte: ne_lng },
      };

      rawProjects = await prisma.project.findMany({
        where,
        select: selectFields,
        take: limit,
      });
    }

    const coordCounts = new Map<string, number>();

    const features: GeoJSONFeature[] = rawProjects
      .filter((p) => p.gpsLng != null && p.gpsLat != null)
      .map((p) => {
        let lat = p.gpsLat;
        let lng = p.gpsLng;

        // Disperse co-located projects so they break apart into distinct pins instead of stacking directly
        const coordKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
        const idx = coordCounts.get(coordKey) || 0;
        coordCounts.set(coordKey, idx + 1);

        if (idx > 0) {
          const angle = idx * 2.39996; // Golden angle
          const radius = 0.00018 * Math.sqrt(idx);
          lng = Number((lng + (radius / Math.cos((lat * Math.PI) / 180)) * Math.cos(angle)).toFixed(6));
          lat = Number((lat + radius * Math.sin(angle)).toFixed(6));
        }

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          properties: {
            id: p.id,
            name: p.name,
            budgetPHP: p.budgetPHP,
            progress: p.progress,
            status: p.status,
            category: p.category,
            flagOverdue: Boolean(p.flagOverdue),
            flagOverpaid: Boolean(p.flagOverpaid),
            flagStalled: Boolean(p.flagStalled),
            flagNeverStarted: Boolean(p.flagNeverStarted),
            contractorRaw: p.contractorRaw || '',
            avgRating: p.avgRating || 0,
          },
        };
      });

    const response: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    if (isNationwide) {
      cachedNationwideGeoJSON = {
        data: response,
        timestamp: Date.now(),
      };
    }

    return Response.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error fetching map clusters:', error);
    return Response.json({ error: 'Failed to fetch map clusters' }, { status: 500 });
  }
}
