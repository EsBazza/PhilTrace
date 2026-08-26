import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { DEMO_PHONE_NUMBER, OTP_EXPIRY_MINUTES } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const { phone, projectId } = (await request.json()) as {
      phone: string;
      projectId?: string;
    };

    if (!phone) {
      return Response.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const trimmedPhone = phone.trim();

    // If requesting OTP for a specific project rating/review:
    if (projectId) {
      const phoneHash = crypto.createHash('sha256').update(trimmedPhone).digest('hex');

      // Check if user has already reviewed this project
      const existingReview = await prisma.review.findFirst({
        where: {
          projectId,
          phoneHash,
        },
      });

      if (existingReview) {
        return Response.json(
          {
            error:
              'This phone number has already submitted a review for this project. Only 1 rating per project is allowed.',
          },
          { status: 400 }
        );
      }

      // Invalidate any previously generated unused OTPs for this phone & project
      await prisma.otpCode.updateMany({
        where: {
          phone: trimmedPhone,
          projectId,
          used: false,
        },
        data: { used: true },
      });
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP with optional projectId
    await prisma.otpCode.create({
      data: {
        phone: trimmedPhone,
        code,
        projectId: projectId || null,
        expiresAt,
      },
    });

    // Demo bypass — don't send SMS
    if (env.DEMO_OTP_BYPASS() && trimmedPhone === DEMO_PHONE_NUMBER) {
      return Response.json({ success: true, demo: true, code });
    }

    // Send via Semaphore
    const smsResponse = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: env.SEMAPHORE_API_KEY(),
        number: trimmedPhone,
        message: `Your PhilTrace verification code is: ${code}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
      }),
    });

    if (!smsResponse.ok) {
      console.error('Semaphore SMS error:', await smsResponse.text());
      return Response.json(
        { error: 'Failed to send OTP SMS' },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return Response.json(
      { error: 'Failed to process OTP request' },
      { status: 500 }
    );
  }
}
