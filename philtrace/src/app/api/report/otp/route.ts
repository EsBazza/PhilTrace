import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { DEMO_PHONE_NUMBER, OTP_EXPIRY_MINUTES } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json() as { phone: string };

    if (!phone) {
      return Response.json(
        { error: 'phone is required' },
        { status: 400 }
      );
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP
    await prisma.otpCode.create({
      data: { phone, code, expiresAt },
    });

    // Demo bypass — don't send SMS
    if (env.DEMO_OTP_BYPASS() && phone === DEMO_PHONE_NUMBER) {
      return Response.json({ success: true, demo: true, code });
    }

    // Send via Semaphore
    const smsResponse = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: env.SEMAPHORE_API_KEY(),
        number: phone,
        message: `Your PhilTrace verification code is: ${code}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
      }),
    });

    if (!smsResponse.ok) {
      console.error('Semaphore SMS error:', await smsResponse.text());
      return Response.json(
        { error: 'Failed to send OTP' },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return Response.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
