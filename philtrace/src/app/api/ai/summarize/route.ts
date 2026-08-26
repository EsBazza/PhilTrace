import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { getAllActiveFlags } from '@/lib/anomaly-flags';
import { formatCurrency } from '@/lib/format';

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json() as { projectId: string };

    if (!projectId) {
      return Response.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return Response.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Return cached summary if available
    if (project.aiSummary) {
      return Response.json({ summary: project.aiSummary, cached: true });
    }

    // Build flags list
    const flags = getAllActiveFlags({
      flagStalled: project.flagStalled,
      flagNeverStarted: project.flagNeverStarted,
      flagOverdue: project.flagOverdue,
      flagOverpaid: project.flagOverpaid,
      flagPaymentPending: project.flagPaymentPending,
    });

    const prompt = `You are helping a Filipino citizen understand a government project. In 3 plain sentences, explain what this project is, its current status, and any concerns based on these flags: [${flags.join(', ')}]. Project: [${project.name}]. Budget: ${formatCurrency(project.budgetPHP)}. Progress: ${project.progress}%. Respond in clear, simple English.`;

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY() });
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    const summary = response.text ?? 'Unable to generate summary.';

    // Cache the summary
    await prisma.project.update({
      where: { id: projectId },
      data: { aiSummary: summary },
    });

    return Response.json({ summary, cached: false });
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return Response.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
