import { execFile } from 'child_process';
import path from 'path';
import { prisma } from './prisma';
import { computeAnomalyFlags, computeRiskScore } from './anomaly-flags';
import { cleanProjectTitle } from './title-cleaner';
import { resolveProvinceAndRegion } from './geo-spatial';

export interface ScrapedContractData {
  contractId: string;
  description: string;
  category: string;
  status: string;
  budget: number;
  amountPaid: number;
  progress: number;
  location?: {
    region?: string;
    province?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
  };
  contractor?: string;
  startDate?: string;
  completionDate?: string;
  infraYear?: string;
  programName?: string;
  sourceOfFunds?: string;
  components?: Array<{
    componentId?: string;
    description?: string;
    infraType?: string;
    typeOfWork?: string;
  }>;
  bidders?: Array<{
    name: string;
    pcabId?: string;
    participation?: number;
    isWinner?: boolean;
  }>;
  procurement?: {
    contractName?: string;
    abc?: string;
    status?: string;
    fundingInstrument?: string;
    advertisementDate?: string;
    bidSubmissionDeadline?: string;
    dateOfAward?: string;
    awardAmount?: string;
  };
  links?: {
    advertisement?: string;
    contractAgreement?: string;
    noticeOfAward?: string;
    noticeToProceed?: string;
    programOfWork?: string;
    engineeringDesign?: string;
  };
  latitude?: number;
  longitude?: number;
  imageSummary?: {
    totalImages?: number;
    latestImageDate?: string;
    hasImages?: boolean;
  };
  error?: string;
}

/**
 * Executes the Python DPWH scraper with TLS browser impersonation
 * to fetch official contract details directly from https://api.transparency.dpwh.gov.ph/projects/{contractId}
 */
export async function fetchLiveContractFromScraper(contractId: string): Promise<ScrapedContractData | null> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_dpwh_contract.py');

  return new Promise((resolve) => {
    execFile(
      'python',
      [scriptPath, contractId.trim()],
      { timeout: 20000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          console.warn(`[DPWH Scraper] Execution failed for ${contractId}:`, error.message);
          return resolve(null);
        }

        try {
          const parsed: ScrapedContractData = JSON.parse(stdout);
          if (parsed.error || !parsed.contractId) {
            console.warn(`[DPWH Scraper] Error returned for ${contractId}:`, parsed.error);
            return resolve(null);
          }
          resolve(parsed);
        } catch (parseErr) {
          console.warn(`[DPWH Scraper] Failed to parse output for ${contractId}:`, parseErr);
          resolve(null);
        }
      }
    );
  });
}

/**
 * Ingests or synchronizes a scraped contract and its official documents into the database
 */
export async function syncScrapedContractToDb(data: ScrapedContractData) {
  const contractId = data.contractId;
  const now = new Date();

  const lat = data.latitude || data.location?.coordinates?.latitude || 14.5995;
  const lng = data.longitude || data.location?.coordinates?.longitude || 120.9842;
  const budget = Number(data.budget) || 0;
  const amountPaid = Number(data.amountPaid) || 0;
  const progress = Number(data.progress) || 0;

  const startDate = data.startDate ? new Date(data.startDate) : now;
  const completionDate = data.completionDate ? new Date(data.completionDate) : null;

  // Resolve province / region
  const spatial = resolveProvinceAndRegion(lng, lat);
  let province = await prisma.province.findFirst({
    where: {
      name: {
        contains: spatial?.province || data.location?.province?.replace(/DEO/g, '').trim() || '',
        mode: 'insensitive',
      },
    },
  });

  if (!province) {
    province = await prisma.province.findFirst();
  }

  const provinceId = province?.id || '';

  const anomaly = computeAnomalyFlags(
    {
      progress,
      budgetPHP: budget,
      amountPaid,
      startDate,
      completionDate,
      status: data.status,
    },
    null,
    0
  );

  // Determine official document URLs from scraper
  const links = data.links || {};
  const ca = links.contractAgreement?.trim() || null;
  const ntp = links.noticeToProceed?.trim() || null;
  const noa = links.noticeOfAward?.trim() || null;
  const ad = links.advertisement?.trim() || null;

  const primaryDocUrl =
    ca ||
    ntp ||
    noa ||
    ad ||
    `https://www.dpwh.gov.ph/dpwh/business/procurement/civil-works/contract/${encodeURIComponent(contractId)}`;

  const biddersJson = data.bidders && data.bidders.length > 0 ? JSON.stringify(data.bidders) : null;

  // Upsert Project
  const project = await prisma.project.upsert({
    where: { id: contractId },
    update: {
      name: data.description || 'DPWH Infrastructure Project',
      provinceId,
      gpsLat: lat,
      gpsLng: lng,
      budgetPHP: budget,
      amountPaid,
      progress,
      startDate,
      completionDate,
      status: data.status || 'Completed',
      category: data.category || 'Roads',
      contractorRaw: data.contractor || 'DPWH Registered Contractor',
      flagStalled: anomaly.flagStalled,
      flagNeverStarted: anomaly.flagNeverStarted,
      flagOverdue: anomaly.flagOverdue,
      flagPaymentPending: anomaly.flagPaymentPending,
      flagOverpaid: anomaly.flagOverpaid,
      syncSource: 'dpwh_transparency_api_scraper',
    },
    create: {
      id: contractId,
      name: data.description || 'DPWH Infrastructure Project',
      provinceId,
      gpsLat: lat,
      gpsLng: lng,
      budgetPHP: budget,
      amountPaid,
      progress,
      startDate,
      completionDate,
      status: data.status || 'Completed',
      category: data.category || 'Roads',
      contractorRaw: data.contractor || 'DPWH Registered Contractor',
      flagStalled: anomaly.flagStalled,
      flagNeverStarted: anomaly.flagNeverStarted,
      flagOverdue: anomaly.flagOverdue,
      flagPaymentPending: anomaly.flagPaymentPending,
      flagOverpaid: anomaly.flagOverpaid,
      syncSource: 'dpwh_transparency_api_scraper',
    },
  });

  // Upsert ContractDocument with real document URLs
  const contractDoc = await prisma.contractDocument.upsert({
    where: { projectId: contractId },
    update: {
      sourcePdfUrl: primaryDocUrl,
      contractAgreementUrl: ca,
      noticeToProceedUrl: ntp,
      noticeOfAwardUrl: noa,
      advertisementUrl: ad,
      biddersJson,
      extractionStatus: 'PARSED',
      parsedAt: now,
    },
    create: {
      projectId: contractId,
      sourcePdfUrl: primaryDocUrl,
      contractAgreementUrl: ca,
      noticeToProceedUrl: ntp,
      noticeOfAwardUrl: noa,
      advertisementUrl: ad,
      biddersJson,
      extractionStatus: 'PARSED',
      parsedAt: now,
    },
  });

  return { project, contractDoc };
}
