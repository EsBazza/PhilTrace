import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchNewsForProject } from '@/lib/news-scraper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get('projectId');
    const contractorName = searchParams.get('contractorName');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: any = {};
    if (projectId) {
      where.projectId = projectId;
    } else if (contractorName) {
      where.contractorName = { contains: contractorName, mode: 'insensitive' };
    }

    const articles = await prisma.newsArticle.findMany({
      where,
      orderBy: [{ relevanceScore: 'desc' }, { publishedAt: 'desc' }],
      take: Math.min(limit, 50),
    });

    return Response.json(
      { articles, count: articles.length },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=900',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching news articles:', error);
    return Response.json({ error: 'Failed to fetch news articles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return Response.json({ error: 'projectId is required' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        province: true,
      },
    });

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const articles = await fetchNewsForProject({
      id: project.id,
      name: project.name,
      contractorRaw: project.contractorRaw,
      province: project.province,
      location: project.province?.name,
    });

    return Response.json({ success: true, count: articles.length, articles });
  } catch (error) {
    console.error('Error triggering news scrape:', error);
    return Response.json({ error: 'Failed to scrape news articles' }, { status: 500 });
  }
}
