import { DOMParser } from '@xmldom/xmldom';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { cleanContractorName } from '@/lib/format';

export interface RawScrapedArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: Date;
}

interface ProjectForNews {
  id: string;
  name: string;
  contractorRaw: string;
  province?: { name: string } | null;
  location?: string | null;
}

/**
 * Score relevance of an article to a public infrastructure project (0.0 to 1.0).
 */
export function scoreArticleRelevance(
  article: { title: string; description: string; publishedAt: Date },
  project: { contractorName: string; municipality: string; province: string }
): number {
  let score = 0;
  const fullText = `${article.title} ${article.description}`.toLowerCase();
  const titleLower = article.title.toLowerCase();

  // 1. Contractor name match (+0.4)
  if (project.contractorName && project.contractorName.length > 3) {
    const contLower = project.contractorName.toLowerCase();
    if (fullText.includes(contLower)) {
      score += 0.4;
    }
  }

  // 2. Municipality match (+0.3)
  if (project.municipality && project.municipality.length > 2) {
    if (fullText.includes(project.municipality.toLowerCase())) {
      score += 0.3;
    }
  }

  // 3. Province match (+0.2)
  if (project.province && project.province.length > 2) {
    if (fullText.includes(project.province.toLowerCase())) {
      score += 0.2;
    }
  }

  // 4. Forensic keywords in title (+0.2)
  const forensicKeywords = [
    'dpwh',
    'flood control',
    'infrastructure',
    'irregularit',
    'nbi',
    'coa',
    'ghost project',
    'overpriced',
    'stalled',
    'substandard',
  ];
  if (forensicKeywords.some((kw) => titleLower.includes(kw))) {
    score += 0.2;
  }

  // 5. Recency (+0.1 if within 90 days, +0.1 extra if within 30 days)
  const now = Date.now();
  const pubTime = article.publishedAt.getTime();
  const daysDiff = (now - pubTime) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 90 && daysDiff >= 0) {
    score += 0.1;
    if (daysDiff <= 30) {
      score += 0.1;
    }
  }

  return Math.min(1.0, Math.round(score * 10) / 10);
}

/**
 * Fetch articles from Google News RSS feed.
 */
async function fetchGoogleNewsRss(query: string): Promise<RawScrapedArticle[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const encoded = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-PH&gl=PH&ceid=PH:en`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];

    const xmlText = await res.text();
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const items = doc.getElementsByTagName('item');
    const results: RawScrapedArticle[] = [];

    for (let i = 0; i < Math.min(items.length, 10); i++) {
      const item = items[i];
      const title = item.getElementsByTagName('title')[0]?.textContent || '';
      const link = item.getElementsByTagName('link')[0]?.textContent || '';
      const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';
      const descRaw = item.getElementsByTagName('description')[0]?.textContent || '';
      const source = item.getElementsByTagName('source')[0]?.textContent || 'Google News';

      // Strip HTML from description
      const cleanDesc = descRaw.replace(/<[^>]*>?/gm, '').trim();

      if (title && link) {
        results.push({
          title: title.trim(),
          description: cleanDesc,
          url: link.trim(),
          source: source.trim(),
          publishedAt: pubDate ? new Date(pubDate) : new Date(),
        });
      }
    }

    return results;
  } catch (err: unknown) {
    if ((err as Error).name !== 'AbortError') {
      console.warn('Google News RSS fetch error:', err);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch articles from NewsAPI.org if API key is provided.
 */
async function fetchNewsApi(query: string): Promise<RawScrapedArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const encoded = encodeURIComponent(query);
    const url = `https://newsapi.org/v2/everything?q=${encoded}&language=en&sortBy=relevancy&pageSize=10&apiKey=${apiKey}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.articles || !Array.isArray(data.articles)) return [];

    return data.articles.map((a: any) => ({
      title: a.title || '',
      description: a.description || '',
      url: a.url || '',
      source: a.source?.name || 'NewsAPI',
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(),
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch articles from Bing News Search if API key is provided.
 */
async function fetchBingNews(query: string): Promise<RawScrapedArticle[]> {
  const apiKey = process.env.BING_NEWS_KEY;
  if (!apiKey) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.bing.microsoft.com/v7.0/news/search?q=${encoded}&mkt=en-PH&count=10`;
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      signal: controller.signal,
    });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.value || !Array.isArray(data.value)) return [];

    return data.value.map((a: any) => ({
      title: a.name || '',
      description: a.description || '',
      url: a.url || '',
      source: a.provider?.[0]?.name || 'Bing News',
      publishedAt: a.datePublished ? new Date(a.datePublished) : new Date(),
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Gemini Flash to generate a 2-3 sentence factual forensic summary.
 */
async function generateAiSummary(title: string, description: string): Promise<string | null> {
  try {
    const apiKey = env.GEMINI_API_KEY();
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = `You are a forensic analyst. Given a news article about Philippine public infrastructure, extract a 2–3 sentence factual summary focused only on: specific peso amounts, contractor names, project locations, government officials named, legal proceedings, and construction status. Do not add opinions. Output only the summary, no preamble.`;

    const userPrompt = `Title: ${title}\n\nDescription: ${description}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    return response.text?.trim() || null;
  } catch (err) {
    console.error('Gemini news summarization error:', err);
    return null;
  }
}

/**
 * Core scraping & intelligence service for a specific project.
 */
export async function fetchNewsForProject(project: ProjectForNews) {
  const contractorName = cleanContractorName(project.contractorRaw || '');
  const provinceName = project.province?.name || '';
  const municipality = project.location || '';

  // Generate 3 search queries
  const titleWords = project.name.split(/\s+/).slice(0, 8).join(' ');
  const queries: string[] = [];

  if (municipality || provinceName) {
    queries.push(`"${municipality || provinceName}" DPWH OR "flood control" OR "infrastructure"`);
  }
  if (contractorName && contractorName.length > 3) {
    queries.push(`"${contractorName}" DPWH OR contractor OR irregularity`);
  }
  if (titleWords.length > 5) {
    queries.push(`"${titleWords}" site:philstar.com OR site:inquirer.net OR site:rappler.com`);
  }

  const rawArticles: RawScrapedArticle[] = [];

  for (const q of queries) {
    // 1. Google News RSS (always active)
    const rssArticles = await fetchGoogleNewsRss(q);
    rawArticles.push(...rssArticles);

    // 2. NewsAPI.org (if configured)
    const newsApiArticles = await fetchNewsApi(q);
    rawArticles.push(...newsApiArticles);

    // 3. Bing News (if configured)
    const bingArticles = await fetchBingNews(q);
    rawArticles.push(...bingArticles);
  }

  // Deduplicate by URL
  const uniqueMap = new Map<string, RawScrapedArticle>();
  for (const a of rawArticles) {
    if (a.url && !uniqueMap.has(a.url)) {
      uniqueMap.set(a.url, a);
    }
  }

  const savedArticles: any[] = [];

  for (const article of uniqueMap.values()) {
    const relevanceScore = scoreArticleRelevance(article, {
      contractorName,
      municipality,
      province: provinceName,
    });

    // Only persist articles with relevance >= 0.3
    if (relevanceScore >= 0.3) {
      let aiSummary: string | null = null;
      let aiIngested = false;

      // Ingest via Gemini Flash if high relevance
      if (relevanceScore >= 0.5) {
        aiSummary = await generateAiSummary(article.title, article.description);
        if (aiSummary) aiIngested = true;
      }

      const saved = await prisma.newsArticle.upsert({
        where: { url: article.url },
        update: {
          projectId: project.id,
          contractorName: contractorName || null,
          location: municipality || provinceName || null,
          title: article.title,
          description: article.description,
          source: article.source,
          publishedAt: article.publishedAt,
          relevanceScore,
          aiIngested: aiIngested || undefined,
          aiSummary: aiSummary || undefined,
        },
        create: {
          projectId: project.id,
          contractorName: contractorName || null,
          location: municipality || provinceName || null,
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source,
          publishedAt: article.publishedAt,
          relevanceScore,
          aiIngested,
          aiSummary,
        },
      });

      savedArticles.push(saved);
    }
  }

  return savedArticles;
}
