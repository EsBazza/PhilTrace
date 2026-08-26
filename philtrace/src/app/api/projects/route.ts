import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const region = searchParams.get('region');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const flag = searchParams.get('flag');
    const province = searchParams.get('province');
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const sort = searchParams.get('sort') ?? 'budgetPHP';
    const order = searchParams.get('order') ?? 'desc';
    const q = searchParams.get('q') ?? searchParams.get('search');

    const where: Prisma.ProjectWhereInput = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
        { contractorRaw: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (region) {
      where.province = {
        region: { name: region },
      };
    }

    if (province) {
      where.province = {
        ...where.province as Prisma.ProvinceWhereInput,
        name: province,
      };
    }

    if (status) {
      where.status = status;
    }

    if (category && category !== 'All') {
      where.category = { contains: category, mode: 'insensitive' };
    }

    if (flag) {
      switch (flag) {
        case 'stalled':
          where.flagStalled = true;
          break;
        case 'neverStarted':
          where.flagNeverStarted = true;
          break;
        case 'overdue':
          where.flagOverdue = true;
          break;
        case 'overpaid':
          where.flagOverpaid = true;
          break;
        case 'paymentPending':
          where.flagPaymentPending = true;
          break;
      }
    }

    const validSortFields = ['budgetPHP', 'progress', 'startDate', 'updatedAt'];
    const sortField = validSortFields.includes(sort) ? sort : 'budgetPHP';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          province: {
            include: { region: true },
          },
        },
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    return Response.json({
      projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return Response.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
