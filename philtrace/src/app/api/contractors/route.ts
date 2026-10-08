import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get('q') ?? searchParams.get('search');
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const sort = searchParams.get('sort') ?? 'totalValuePHP';
    const order = searchParams.get('order') ?? 'desc';
    const risk = searchParams.get('risk'); // 'clean' | 'overdue' | 'highrisk'

    const where: Prisma.ContractorWhereInput = {};

    if (q) {
      where.name = { contains: q, mode: 'insensitive' };
    }

    if (risk === 'clean') {
      where.overdueCount = { equals: 0 };
      where.terminatedCount = { equals: 0 };
    } else if (risk === 'overdue') {
      where.overdueCount = { gte: 1, lte: 3 };
    } else if (risk === 'highrisk') {
      where.OR = [
        { overdueCount: { gt: 3 } },
        { terminatedCount: { gt: 0 } },
      ];
    }

    const validSortFields = ['totalValuePHP', 'totalContracts', 'avgProgress', 'overdueCount', 'name'];
    const sortField = validSortFields.includes(sort) ? sort : 'totalValuePHP';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [contractors, total] = await Promise.all([
      prisma.contractor.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contractor.count({ where }),
    ]);

    return Response.json({
      contractors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching contractors:', error);
    return Response.json(
      { error: 'Failed to fetch contractors' },
      { status: 500 }
    );
  }
}
