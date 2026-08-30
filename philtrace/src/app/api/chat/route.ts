import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import type { Prisma } from '@prisma/client';

// ─── Intent Extraction Types ────────────────────────────────

interface ExtractedIntent {
  region?: string;
  province?: string;
  contractor?: string;
  category?: string;
  flagType?: 'overdue' | 'overpaid' | 'stalled' | 'neverStarted';
  status?: string;
}

/**
 * Extract structured search intent from a natural language query.
 * Uses keyword matching to avoid an extra Gemini round-trip.
 */
function extractIntent(message: string): ExtractedIntent {
  const lower = message.toLowerCase();
  const intent: ExtractedIntent = {};

  // Flag detection
  if (lower.includes('overdue') || lower.includes('late') || lower.includes('delayed')) {
    intent.flagType = 'overdue';
  } else if (lower.includes('overpaid') || lower.includes('ghost') || lower.includes('corrupt')) {
    intent.flagType = 'overpaid';
  } else if (lower.includes('stalled') || lower.includes('abandoned') || lower.includes('stopped')) {
    intent.flagType = 'stalled';
  } else if (lower.includes('never started') || lower.includes('not started')) {
    intent.flagType = 'neverStarted';
  }

  // Category detection
  const categories = ['flood control', 'bridge', 'road', 'highway', 'building', 'water supply', 'school'];
  for (const cat of categories) {
    if (lower.includes(cat)) {
      intent.category = cat;
      break;
    }
  }

  // Status detection
  if (lower.includes('completed') || lower.includes('done') || lower.includes('finished')) {
    intent.status = 'Completed';
  } else if (lower.includes('on-going') || lower.includes('ongoing') || lower.includes('active')) {
    intent.status = 'On-Going';
  }

  return intent;
}

/**
 * Build a Prisma where clause from extracted intent.
 */
async function buildWhereFromIntent(intent: ExtractedIntent): Promise<Prisma.ProjectWhereInput> {
  const where: Prisma.ProjectWhereInput = {};

  // Flag filtering
  if (intent.flagType === 'overdue') where.flagOverdue = true;
  if (intent.flagType === 'overpaid') where.flagOverpaid = true;
  if (intent.flagType === 'stalled') where.flagStalled = true;
  if (intent.flagType === 'neverStarted') where.flagNeverStarted = true;

  // Category filtering (case-insensitive contains)
  if (intent.category) {
    where.category = { contains: intent.category, mode: 'insensitive' };
  }

  // Status filtering
  if (intent.status) {
    where.status = intent.status;
  }

  // Contractor filtering
  if (intent.contractor) {
    where.contractorRaw = { contains: intent.contractor, mode: 'insensitive' };
  }

  // Region/province filtering via name search
  if (intent.province) {
    const provinces = await prisma.province.findMany({
      where: { name: { contains: intent.province, mode: 'insensitive' } },
      select: { id: true },
    });
    if (provinces.length > 0) {
      where.provinceId = { in: provinces.map(p => p.id) };
    }
  } else if (intent.region) {
    const regions = await prisma.region.findMany({
      where: { name: { contains: intent.region, mode: 'insensitive' } },
      select: { id: true },
    });
    if (regions.length > 0) {
      const provinces = await prisma.province.findMany({
        where: { regionId: { in: regions.map(r => r.id) } },
        select: { id: true },
      });
      where.provinceId = { in: provinces.map(p => p.id) };
    }
  }

  return where;
}

// ─── RAG System Prompt ──────────────────────────────────────

const SYSTEM_PROMPT = `You are PhilTrace AI, a civic transparency assistant for Philippine public infrastructure. Answer ONLY using the project data provided below. If the answer cannot be found in the provided data, say: 'I do not have that information in the current database.' Never state amounts, names, contractor details, project statuses, or any facts that are not explicitly present in the data below. Always include project IDs in your answers so users can click through to the full record.`;

// ─── Main Chat Endpoint ─────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json() as { message: string };

    if (!message) {
      return Response.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    // Step 1: Extract intent from natural language
    const intent = extractIntent(message);

    // Step 2: Run structured DB query based on extracted intent
    const where = await buildWhereFromIntent(intent);
    const projects = await prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        budgetPHP: true,
        amountPaid: true,
        progress: true,
        status: true,
        category: true,
        contractorRaw: true,
        flagOverdue: true,
        flagOverpaid: true,
        flagStalled: true,
        flagNeverStarted: true,
        province: {
          select: {
            name: true,
            region: { select: { name: true } },
          },
        },
      },
      orderBy: { budgetPHP: 'desc' },
      take: 20,
    });

    // Step 3: Serialize context for Gemini
    const projectContext = projects.map(p => ({
      id: p.id,
      name: p.name,
      province: p.province?.name,
      region: p.province?.region?.name,
      budget: p.budgetPHP,
      paid: p.amountPaid,
      progress: p.progress,
      status: p.status,
      category: p.category,
      contractor: p.contractorRaw,
      flags: [
        p.flagOverdue && 'Overdue',
        p.flagOverpaid && 'Overpaid',
        p.flagStalled && 'Stalled',
        p.flagNeverStarted && 'NeverStarted',
      ].filter(Boolean),
    }));

    // Also include aggregate stats for broader context
    const [totalProjects, totalFlagged] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({
        where: {
          OR: [
            { flagStalled: true },
            { flagOverdue: true },
            { flagOverpaid: true },
            { flagNeverStarted: true },
          ],
        },
      }),
    ]);

    const contextData = {
      totalProjectsInDatabase: totalProjects,
      totalFlaggedProjects: totalFlagged,
      matchingProjects: projectContext,
      matchCount: projectContext.length,
    };

    // Step 4: Inject into Gemini with strict system prompt
    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\nData: ${JSON.stringify(contextData)}`;

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY() });

    const response = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: fullSystemPrompt,
      },
    });

    // Stream response back with source project IDs
    const sourceProjectIds = projects.map(p => p.id);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send source IDs first
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ sourceIds: sourceProjectIds })}\n\n`)
          );

          for await (const chunk of response) {
            const text = chunk.text ?? '';
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('Stream error:', err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat:', error);
    return Response.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
