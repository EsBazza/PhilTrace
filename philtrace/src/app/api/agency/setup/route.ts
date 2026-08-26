import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

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

    const agencies = [
      {
        email: 'dpwh-admin@philtrace.ph',
        password: 'dpwh-demo-2026',
        agencyName: 'Department of Public Works and Highways',
      },
      {
        email: 'neda-admin@philtrace.ph',
        password: 'neda-demo-2026',
        agencyName: 'National Economic and Development Authority',
      },
    ];

    const results = [];
    for (const agency of agencies) {
      const passwordHash = await bcrypt.hash(agency.password, 12);
      const account = await prisma.agencyAccount.upsert({
        where: { email: agency.email },
        update: { passwordHash, agencyName: agency.agencyName },
        create: {
          email: agency.email,
          passwordHash,
          agencyName: agency.agencyName,
        },
      });
      results.push({ email: account.email, agencyName: account.agencyName });
    }

    return Response.json({ success: true, accounts: results });
  } catch (error) {
    console.error('Error setting up agency accounts:', error);
    return Response.json(
      { error: 'Failed to set up agency accounts' },
      { status: 500 }
    );
  }
}
