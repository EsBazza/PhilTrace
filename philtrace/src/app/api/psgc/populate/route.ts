import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

interface PSGCRegion {
  code: string;
  name: string;
}

interface PSGCProvince {
  code: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET()}`) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = env.PSA_PSGC_TOKEN();
    const version = 'v2';

    // Fetch regions
    const regionsRes = await fetch(
      `https://classification.psa.gov.ph/psgc/${version}/regions?token=${token}`
    );

    if (!regionsRes.ok) {
      return Response.json(
        { error: `Failed to fetch regions: ${regionsRes.status}` },
        { status: 502 }
      );
    }

    const regionsData = await regionsRes.json() as PSGCRegion[];
    let regionCount = 0;
    let provinceCount = 0;

    for (const region of regionsData) {
      // Upsert region
      const dbRegion = await prisma.region.upsert({
        where: { psgcCode: region.code },
        update: { name: region.name },
        create: {
          psgcCode: region.code,
          name: region.name,
        },
      });
      regionCount++;

      // Fetch provinces for this region
      const provincesRes = await fetch(
        `https://classification.psa.gov.ph/psgc/${version}/provinces?token=${token}&reg=${region.code}`
      );

      if (!provincesRes.ok) {
        console.error(`Failed to fetch provinces for ${region.name}: ${provincesRes.status}`);
        continue;
      }

      const provincesData = await provincesRes.json() as PSGCProvince[];

      for (const province of provincesData) {
        await prisma.province.upsert({
          where: { psgcCode: province.code },
          update: { name: province.name, regionId: dbRegion.id },
          create: {
            psgcCode: province.code,
            name: province.name,
            regionId: dbRegion.id,
          },
        });
        provinceCount++;
      }

      // Small delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return Response.json({
      success: true,
      regions: regionCount,
      provinces: provinceCount,
    });
  } catch (error) {
    console.error('Error populating PSGC data:', error);
    return Response.json(
      { error: 'Failed to populate PSGC data' },
      { status: 500 }
    );
  }
}
