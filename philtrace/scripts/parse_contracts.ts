import { GoogleGenAI } from '@google/genai';
import { prisma } from '../src/lib/prisma';
import { env } from '../src/lib/env';

interface BOQItemExtracted {
  item_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost_php: number;
  total_php: number;
}

interface ContractExtractedData {
  contractor_legal_name?: string;
  contractor_address?: string;
  authorized_officer_name?: string;
  tin_number?: string;
  signing_engineer_name?: string;
  signing_engineer_title?: string;
  signing_engineer_district?: string;
  contract_duration_days?: number;
  bill_of_quantities?: BOQItemExtracted[];
}

const EXTRACTION_PROMPT = `Extract the following fields from this DPWH contract PDF and return ONLY a valid JSON object with no markdown, no explanation, no preamble:
{
  "contractor_legal_name": "string",
  "contractor_address": "string",
  "authorized_officer_name": "string",
  "tin_number": "string",
  "signing_engineer_name": "string",
  "signing_engineer_title": "string",
  "signing_engineer_district": "string",
  "contract_duration_days": 180,
  "bill_of_quantities": [
    {
      "item_code": "string",
      "description": "string",
      "quantity": 100.0,
      "unit": "sq.m.",
      "unit_cost_php": 2500.0,
      "total_php": 250000.0
    }
  ]
}`;

export async function parseContractPdf(
  projectId: string,
  sourcePdfUrl: string
): Promise<boolean> {
  const apiKey = env.GEMINI_API_KEY();
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured.');
    return false;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    console.log(`Fetching PDF for project ${projectId}: ${sourcePdfUrl}`);
    const pdfResponse = await fetch(sourcePdfUrl, { signal: AbortSignal.timeout(30000) });
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: HTTP ${pdfResponse.status}`);
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const base64Pdf = pdfBuffer.toString('base64');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Pdf,
                mimeType: 'application/pdf',
              },
            },
            {
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const responseText = response.text || '';
    const cleanedJson = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed: ContractExtractedData = JSON.parse(cleanedJson);

    // Save to database
    await prisma.$transaction(async (tx) => {
      const doc = await tx.contractDocument.upsert({
        where: { projectId },
        update: {
          sourcePdfUrl,
          contractorLegalName: parsed.contractor_legal_name || null,
          contractorAddress: parsed.contractor_address || null,
          authorizedOfficer: parsed.authorized_officer_name || null,
          tinNumber: parsed.tin_number || null,
          contractDurationDays: parsed.contract_duration_days || null,
          extractionStatus: 'PARSED',
          parsedAt: new Date(),
        },
        create: {
          projectId,
          sourcePdfUrl,
          contractorLegalName: parsed.contractor_legal_name || null,
          contractorAddress: parsed.contractor_address || null,
          authorizedOfficer: parsed.authorized_officer_name || null,
          tinNumber: parsed.tin_number || null,
          contractDurationDays: parsed.contract_duration_days || null,
          extractionStatus: 'PARSED',
          parsedAt: new Date(),
        },
      });

      if (parsed.signing_engineer_name) {
        await tx.engineerSignature.upsert({
          where: { contractDocId: doc.id },
          update: {
            engineerName: parsed.signing_engineer_name,
            engineerTitle: parsed.signing_engineer_title || 'District Engineer',
            district: parsed.signing_engineer_district || null,
          },
          create: {
            contractDocId: doc.id,
            engineerName: parsed.signing_engineer_name,
            engineerTitle: parsed.signing_engineer_title || 'District Engineer',
            district: parsed.signing_engineer_district || null,
          },
        });
      }

      if (parsed.bill_of_quantities && parsed.bill_of_quantities.length > 0) {
        await tx.billOfQuantity.deleteMany({ where: { contractDocId: doc.id } });
        await tx.billOfQuantity.createMany({
          data: parsed.bill_of_quantities.map((item) => ({
            contractDocId: doc.id,
            itemCode: item.item_code || 'N/A',
            description: item.description || '',
            quantity: Number(item.quantity) || 1,
            unit: item.unit || 'unit',
            unitCostPhp: Number(item.unit_cost_php) || 0,
            totalPhp: Number(item.total_php) || 0,
          })),
        });
      }
    });

    console.log(`Successfully extracted and saved BOQ for project ${projectId}`);
    return true;
  } catch (error) {
    console.error(`Failed to parse PDF for project ${projectId}:`, error);
    await prisma.contractDocument.upsert({
      where: { projectId },
      update: {
        sourcePdfUrl,
        extractionStatus: 'FAILED',
      },
      create: {
        projectId,
        sourcePdfUrl,
        extractionStatus: 'FAILED',
      },
    });
    return false;
  }
}
