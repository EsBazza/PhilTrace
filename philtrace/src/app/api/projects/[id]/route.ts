import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { resolveProvinceAndRegion } from '@/lib/geo-spatial';
import { cleanProjectTitle } from '@/lib/title-cleaner';
import { computeRiskScore, computeAnomalyFlags } from '@/lib/anomaly-flags';
import { fetchLiveContractFromScraper, syncScrapedContractToDb } from '@/lib/dpwh-scraper';

async function fallbackIngestFromGeo(id: string) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'geo', 'all_projects.json');
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, 'utf8');
    const needle = `"i":"${id}"`;
    const idx = content.indexOf(needle);
    if (idx === -1) return null;

    const start = content.lastIndexOf('{"type":"Feature"', idx);
    const end = content.indexOf('}}', idx) + 2;
    if (start === -1 || end <= start) return null;

    const snippet = content.substring(start, end);
    const feature = JSON.parse(snippet);

    const coords = feature.geometry?.coordinates || [120.9842, 14.5995];
    const lng = coords[0];
    const lat = coords[1];
    const props = feature.properties || {};

    const spatial = resolveProvinceAndRegion(lng, lat);
    let provinceId: string | null = null;
    if (spatial?.province) {
      const prov = await prisma.province.findFirst({
        where: { name: { contains: spatial.province, mode: 'insensitive' } },
      });
      if (prov) provinceId = prov.id;
    }

    if (!provinceId) {
      const defaultProv = await prisma.province.findFirst();
      provinceId = defaultProv?.id || '';
    }

    const statusMap: Record<number, string> = {
      0: 'Completed',
      1: 'Ongoing',
      2: 'Not Yet Started',
      3: 'Suspended',
    };
    const status = statusMap[props.s] || 'Ongoing';
    const progress = Number(props.g) || 0;
    const budget = (Number(props.b) || 0) * 1000;
    const category = props.c || 'Flood Control and Drainage';
    const name = props.n || 'DPWH Infrastructure Project';

    const now = new Date();
    const anomaly = computeAnomalyFlags(
      {
        status,
        progress,
        startDate: now,
        completionDate: null,
        budgetPHP: budget,
        amountPaid: 0,
      },
      null,
      0
    );

    const newProject = await prisma.project.upsert({
      where: { id },
      update: {
        name,
        gpsLat: lat,
        gpsLng: lng,
        budgetPHP: budget,
        progress,
        status,
        category,
        provinceId,
      },
      create: {
        id,
        name,
        gpsLat: lat,
        gpsLng: lng,
        budgetPHP: budget,
        amountPaid: 0,
        progress,
        startDate: now,
        status,
        category,
        contractorRaw: 'DPWH Registered Contractor',
        provinceId,
        flagStalled: anomaly.flagStalled,
        flagNeverStarted: anomaly.flagNeverStarted,
        flagOverdue: anomaly.flagOverdue,
        flagPaymentPending: anomaly.flagPaymentPending,
        flagOverpaid: anomaly.flagOverpaid,
        syncSource: 'dpwh_national_archive',
      },
      include: {
        province: {
          include: { region: true },
        },
        comments: {
          where: { phoneVerified: true },
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
        },
        contractDocument: {
          include: {
            engineerSignature: true,
          },
        },
      },
    });

    if (!newProject.contractDocument) {
      (newProject as any).contractDocument = {
        sourcePdfUrl: `https://www.dpwh.gov.ph/dpwh/business/procurement/civil-works/contract/${encodeURIComponent(id)}`,
      };
    }

    return newProject;
  } catch (err) {
    console.error('Error during fallback project ingestion:', err);
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let project = await prisma.project.findUnique({
      where: { id },
      include: {
        province: {
          include: { region: true },
        },
        comments: {
          where: { phoneVerified: true },
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
        },
        contractDocument: {
          include: {
            engineerSignature: true,
          },
        },
      },
    });

    const hasRealDoc =
      project?.contractDocument?.sourcePdfUrl &&
      !project.contractDocument.sourcePdfUrl.includes('transparency.dpwh.gov.ph') &&
      (project.contractDocument.contractAgreementUrl ||
        project.contractDocument.noticeToProceedUrl ||
        project.contractDocument.noticeOfAwardUrl ||
        project.contractDocument.advertisementUrl ||
        project.contractDocument.sourcePdfUrl.endsWith('.pdf'));

    // If project is missing or only has legacy placeholder URLs, run live DPWH scraper
    if (!project || !hasRealDoc) {
      const scraped = await fetchLiveContractFromScraper(id);
      if (scraped && scraped.contractId) {
        await syncScrapedContractToDb(scraped);
        project = await prisma.project.findUnique({
          where: { id },
          include: {
            province: {
              include: { region: true },
            },
            comments: {
              where: { phoneVerified: true },
              orderBy: { createdAt: 'desc' },
            },
            reviews: {
              orderBy: { createdAt: 'desc' },
            },
            contractDocument: {
              include: {
                engineerSignature: true,
              },
            },
          },
        });
      }
    }

    if (!project) {
      project = await fallbackIngestFromGeo(id);
    }

    if (!project) {
      return Response.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // SPATIAL OVERRIDE: If the project's GPS coordinates resolve to a real province/region,
    // override the inaccurate DB province relation (e.g. Candaba in Pampanga vs NCR).
    let resolvedProvince = project.province?.name;
    let resolvedRegion = project.province?.region?.name;

    if (project.gpsLng && project.gpsLat) {
      const spatial = resolveProvinceAndRegion(project.gpsLng, project.gpsLat);
      if (spatial) {
        resolvedProvince = spatial.province;
        resolvedRegion = spatial.region;
      }
    }

    const cleanedName = cleanProjectTitle(project.name);
    const riskScore = computeRiskScore(project);

    const enrichedProject = {
      ...project,
      name: cleanedName,
      rawName: project.name,
      riskScore,
      province: {
        id: project.province?.id || '',
        name: resolvedProvince || project.province?.name || '',
        region: {
          id: project.province?.region?.id || '',
          name: resolvedRegion || project.province?.region?.name || '',
        },
      },
      contractDocument: project.contractDocument || {
        sourcePdfUrl: `https://www.dpwh.gov.ph/dpwh/business/procurement/civil-works/contract/${encodeURIComponent(id)}`,
      },
    };

    return Response.json(
      { project: enrichedProject, riskScore },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching project:', error);
    return Response.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}
