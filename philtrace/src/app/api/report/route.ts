import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { DEMO_PHONE_NUMBER, MAX_REPORTS_PER_PHONE_PER_PROJECT } from '@/lib/constants';
import { getAllActiveFlags } from '@/lib/anomaly-flags';

interface ReportBody {
  projectId: string;
  text: string;
  phone: string;
  otpCode: string;
  photoUrl?: string;
}

interface SeverityResponse {
  severity: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ReportBody;
    const { projectId, text, phone, otpCode, photoUrl } = body;

    if (!projectId || !text || !phone || !otpCode) {
      return Response.json(
        { error: 'projectId, text, phone, and otpCode are required' },
        { status: 400 }
      );
    }

    // Rate limiting: check phone per project
    const phoneCount = await prisma.comment.count({
      where: { projectId, text: { not: '' } },
    });

    // Check per-project phone limit
    if (phoneCount >= MAX_REPORTS_PER_PHONE_PER_PROJECT * 10) {
      return Response.json(
        { error: 'Too many reports for this project' },
        { status: 429 }
      );
    }

    // Verify OTP
    const isDemoBypass = env.DEMO_OTP_BYPASS() && phone === DEMO_PHONE_NUMBER;

    if (!isDemoBypass) {
      const otpRecord = await prisma.otpCode.findFirst({
        where: {
          phone,
          code: otpCode,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!otpRecord) {
        return Response.json(
          { error: 'Invalid or expired OTP code' },
          { status: 401 }
        );
      }

      // Mark OTP as used
      await prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { used: true },
      });
    }

    // Get project for context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return Response.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Classify severity with Gemini
    const flags = getAllActiveFlags({
      flagStalled: project.flagStalled,
      flagNeverStarted: project.flagNeverStarted,
      flagOverdue: project.flagOverdue,
      flagOverpaid: project.flagOverpaid,
      flagPaymentPending: project.flagPaymentPending,
    });

    const classificationPrompt = `You are a civic transparency AI. A citizen submitted the following report about a Philippine government infrastructure project.
Return ONLY valid JSON in this exact format, nothing else:
{"severity": "low|medium|high|critical", "rationale": "one sentence explaining your severity rating"}

Report text: ${text}
Project status: ${project.status}
Current anomaly flags: ${flags.join(', ') || 'none'}`;

    let severity = 'medium';
    let rationale = 'Unable to classify severity.';

    try {
      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY() });
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: classificationPrompt,
      });

      let responseText = response.text ?? '';
      // Strip markdown code fences if present
      responseText = responseText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

      const parsed = JSON.parse(responseText) as SeverityResponse;
      severity = parsed.severity;
      rationale = parsed.rationale;
    } catch (parseError) {
      console.error('Failed to parse Gemini severity response:', parseError);
      // Use defaults
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        projectId,
        text,
        severity,
        rationale,
        phoneVerified: true,
        photoUrl: photoUrl ?? null,
      },
    });

    // Increment report count on project
    await prisma.project.update({
      where: { id: projectId },
      data: { reportCount: { increment: 1 } },
    });

    return Response.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Error submitting report:', error);
    return Response.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    );
  }
}
