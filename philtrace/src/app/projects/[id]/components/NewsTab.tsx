'use client';

import { useState, useEffect } from 'react';
import {
  Newspaper,
  ExternalLink,
  Loader2,
  Sparkles,
  RefreshCw,
  Clock,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { formatDate } from '@/lib/format';
import { ProjectDetailData } from '@/hooks/use-projects';

interface NewsTabProps {
  project: ProjectDetailData;
}

interface NewsArticleItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  relevanceScore: number;
  aiIngested: boolean;
  aiSummary: string | null;
}

export default function NewsTab({ project }: NewsTabProps) {
  const [articles, setArticles] = useState<NewsArticleItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScraping, setIsScraping] = useState<boolean>(false);

  const loadArticles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/news?projectId=${encodeURIComponent(project.id)}`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
      }
    } catch (err) {
      console.error('Failed to load news articles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const handleFreshScrape = async () => {
    setIsScraping(true);
    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (res.ok) {
        await loadArticles();
      }
    } catch (err) {
      console.error('Failed to trigger fresh scrape:', err);
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Manual Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Media Intelligence & Public Reports</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Indexed investigative news, COA audits, and local reporting matching this project and contractor.
          </p>
        </div>

        <button
          onClick={handleFreshScrape}
          disabled={isScraping}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isScraping ? 'animate-spin text-cyan-400' : ''}`} />
          <span>{isScraping ? 'Scraping feeds...' : 'Refresh Media Feeds'}</span>
        </button>
      </div>

      {/* Articles Feed */}
      {isLoading ? (
        <div className="flex h-48 w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400 mr-2" />
          <span className="text-xs text-slate-400">Scanning news feeds and archive records...</span>
        </div>
      ) : articles.length > 0 ? (
        <div className="space-y-4">
          {articles.map((article) => {
            const matchPct = Math.round(article.relevanceScore * 100);

            return (
              <div
                key={article.id}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow transition hover:bg-slate-900/70 hover:border-slate-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700">
                      {article.source}
                    </span>

                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        matchPct >= 80
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          : matchPct >= 50
                          ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {matchPct}% Forensic Match
                    </span>

                    {article.aiIngested && (
                      <span className="inline-flex items-center gap-1 rounded bg-purple-950/60 px-1.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-800">
                        <Sparkles className="h-3 w-3" />
                        <span>AI Fact Ingested</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(article.publishedAt)}</span>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-white mb-2 leading-snug">
                  {article.title}
                </h4>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                  {article.description}
                </p>

                {/* AI Extracted Forensic Fact Summary */}
                {article.aiSummary && (
                  <div className="rounded-lg bg-cyan-950/20 border border-cyan-900/40 p-3 mb-3 text-xs text-cyan-200">
                    <div className="flex items-center gap-1.5 font-semibold text-cyan-400 mb-1 text-[11px]">
                      <Sparkles className="h-3 w-3" />
                      <span>Gemini Forensic Fact Extraction:</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{article.aiSummary}</p>
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-slate-800/60">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
                  >
                    <span>Read Full Story on {article.source}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-slate-950/40">
          <Newspaper className="mx-auto h-8 w-8 text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-300">
            No News or Investigative Reports Currently Indexed
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
            PhilTrace indexes Google News, Philippine investigative desks, and COA releases nightly.
            Click below to trigger a live automated scan.
          </p>
          <button
            onClick={handleFreshScrape}
            disabled={isScraping}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-cyan-500 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScraping ? 'animate-spin' : ''}`} />
            <span>Scan News Sources Now</span>
          </button>
        </div>
      )}
    </div>
  );
}
