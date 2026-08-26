import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

interface ChatContext {
  totalProjects: number;
  byStatus: { completed: number; ongoing: number; notStarted: number };
  byRegion: Array<{ region: string; count: number; flaggedCount: number }>;
  anomalyCounts: {
    stalled: number;
    neverStarted: number;
    overdue: number;
    paymentPending: number;
    overpaid: number;
  };
  topFlaggedRegions: string[];
  lastSyncAt: string;
}

async function buildChatContext(): Promise<ChatContext> {
  const [totalProjects, completed, ongoing, stalled, neverStarted, overdue, paymentPending, overpaid, lastProject] =
    await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: 'Completed' } }),
      prisma.project.count({ where: { status: 'On-Going' } }),
      prisma.project.count({ where: { flagStalled: true } }),
      prisma.project.count({ where: { flagNeverStarted: true } }),
      prisma.project.count({ where: { flagOverdue: true } }),
      prisma.project.count({ where: { flagPaymentPending: true } }),
      prisma.project.count({ where: { flagOverpaid: true } }),
      prisma.project.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    ]);

  const notStartedCount = totalProjects - completed - ongoing;

  // Get by-region stats
  const regions = await prisma.region.findMany({
    include: {
      provinces: {
        include: {
          _count: { select: { projects: true } },
        },
      },
    },
  });

  const byRegion = await Promise.all(
    regions.map(async (r) => {
      const count = r.provinces.reduce((sum, p) => sum + p._count.projects, 0);
      const flaggedCount = await prisma.project.count({
        where: {
          province: { regionId: r.id },
          OR: [
            { flagStalled: true },
            { flagNeverStarted: true },
            { flagOverdue: true },
            { flagOverpaid: true },
          ],
        },
      });
      return { region: r.name, count, flaggedCount };
    })
  );

  const topFlaggedRegions = byRegion
    .filter((r) => r.count > 0)
    .sort((a, b) => (b.flaggedCount / b.count) - (a.flaggedCount / a.count))
    .slice(0, 5)
    .map((r) => r.region);

  return {
    totalProjects,
    byStatus: { completed, ongoing, notStarted: notStartedCount },
    byRegion,
    anomalyCounts: { stalled, neverStarted, overdue, paymentPending, overpaid },
    topFlaggedRegions,
    lastSyncAt: lastProject?.updatedAt?.toISOString() ?? 'unknown',
  };
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json() as { message: string };

    if (!message) {
      return Response.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    const context = await buildChatContext();

    const systemPrompt = `You are a civic transparency AI assistant for MapaTunAI (Mapping What's Real — Exposing Ghost Projects Across the Philippines), a platform tracking Philippine government infrastructure projects. Answer questions using only the data context provided. Be concise and factual. If asked about a specific project, say you can only answer aggregate questions and suggest the user search for it directly. Context: ${JSON.stringify(context)}`;

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY() });
    const response = await ai.models.generateContentStream({
      model: 'gemini-3.5-flash',
      contents: message,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
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
