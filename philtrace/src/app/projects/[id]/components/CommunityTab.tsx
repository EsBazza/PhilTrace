'use client';

import { useState } from 'react';
import {
  Star,
  ShieldCheck,
  MapPin,
  ThumbsUp,
  MessageSquare,
  Users,
  Camera,
  CheckCircle2,
  HardHat,
  AlertCircle,
} from 'lucide-react';
import { formatDate, formatDistance } from '@/lib/format';
import { ProjectDetailData } from '@/hooks/use-projects';
import ReviewModal from '@/components/review-modal';

interface CommunityTabProps {
  project: ProjectDetailData;
  onReviewSubmitted?: () => void;
}

export default function CommunityTab({ project, onReviewSubmitted }: CommunityTabProps) {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [corroborations, setCorroborations] = useState<Record<string, number>>({});
  const [corroboratedSet, setCorroboratedSet] = useState<Set<string>>(new Set());

  const reviews = project.reviews || [];
  const totalReviews = reviews.length;
  const avgRating = project.avgRating || 0;

  // Star distributions
  const starCounts = [5, 4, 3, 2, 1].map((s) => {
    const count = reviews.filter((r) => Math.round(r.rating) === s).length;
    const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
    return { stars: s, count, pct };
  });

  // Calculate physical progress perception average
  const progressRatings = reviews
    .map((r) => r.progressRating)
    .filter((p): p is number => p !== null && p !== undefined);
  const avgPerceivedProgress =
    progressRatings.length > 0
      ? Math.round(progressRatings.reduce((a, b) => a + b, 0) / progressRatings.length)
      : null;

  // Workforce presence
  const activeWorkerVotes = reviews.filter((r) => r.workersActive === true).length;
  const abandonedVotes = reviews.filter((r) => r.workersActive === false).length;
  const totalWorkerVotes = activeWorkerVotes + abandonedVotes;
  const activePct =
    totalWorkerVotes > 0 ? Math.round((activeWorkerVotes / totalWorkerVotes) * 100) : null;

  const handleCorroborate = async (reviewId: string) => {
    if (corroboratedSet.has(reviewId)) return;

    // Optimistic update
    setCorroboratedSet((prev) => new Set(prev).add(reviewId));
    setCorroborations((prev) => ({
      ...prev,
      [reviewId]: (prev[reviewId] || 0) + 1,
    }));

    try {
      await fetch('/api/reviews/corroborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      });
    } catch (err) {
      console.error('Failed to corroborate review:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Star Rating Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Community Satisfaction
            </h4>
          </div>

          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-3xl font-extrabold text-white">
              {avgRating.toFixed(1)}
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-4 w-4 ${
                    s <= Math.round(avgRating)
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-slate-500">({totalReviews} reviews)</span>
          </div>

          <div className="space-y-1.5">
            {starCounts.map((sc) => (
              <div key={sc.stars} className="flex items-center gap-2 text-xs">
                <span className="w-4 text-slate-400">{sc.stars}★</span>
                <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${sc.pct}%` }}
                  />
                </div>
                <span className="w-6 text-right text-[10px] text-slate-500">
                  {sc.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Physical Progress Perception Contrast */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-cyan-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Ground Reality vs DPWH Claim
              </h4>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Official Claimed Progress</span>
                  <span className="font-bold text-white">{Math.round(project.progress)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-500"
                    style={{ width: `${Math.min(100, project.progress)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Citizen Perceived Completion</span>
                  <span className="font-bold text-amber-400">
                    {avgPerceivedProgress !== null ? `${avgPerceivedProgress}%` : 'No data'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${avgPerceivedProgress || 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {avgPerceivedProgress !== null &&
            project.progress - avgPerceivedProgress >= 25 && (
              <div className="mt-3 rounded bg-rose-950/40 p-2 text-[11px] text-rose-300 border border-rose-800/40">
                ⚠️ Significant divergence between official claim and ground observers.
              </div>
            )}
        </div>

        {/* Workforce Presence Indicator */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HardHat className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Workers on Site
              </h4>
            </div>

            {totalWorkerVotes > 0 ? (
              <div>
                <div className="text-2xl font-black text-white mb-1">
                  {activePct}%{' '}
                  <span className="text-xs font-normal text-slate-400">
                    report active workers
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {activeWorkerVotes} citizens observed workers present, while{' '}
                  {abandonedVotes} reported an abandoned or vacant job site.
                </p>
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                No workforce presence data logged yet. Be the first eyewitness to submit a report.
              </div>
            )}
          </div>

          <button
            onClick={() => setIsReviewModalOpen(true)}
            className="mt-4 inline-flex items-center justify-center gap-1.5 w-full rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white shadow hover:bg-cyan-500 transition"
          >
            <Camera className="h-4 w-4" />
            <span>Submit Eyewitness Report</span>
          </button>
        </div>
      </div>

      {/* 2. Reviews Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Verified Eyewitness Reports ({totalReviews})
          </h4>
        </div>

        {reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((r) => {
              const extraCorroborations = corroborations[r.id] || 0;
              const totalCorroborations = (r.corroborations || 0) + extraCorroborations;
              const hasCorroborated = corroboratedSet.has(r.id);

              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 shadow transition hover:bg-slate-900/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3.5 w-3.5 ${
                              s <= Math.round(r.rating)
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Distance Badge */}
                      {r.distanceKm !== null && r.distanceKm !== undefined && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700">
                          <MapPin className="h-3 w-3 text-cyan-400" />
                          <span>{formatDistance(r.distanceKm)}</span>
                        </span>
                      )}

                      {/* Phone Verified Badge */}
                      {r.phoneVerified && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-800">
                          <ShieldCheck className="h-3 w-3" />
                          <span>SMS Verified</span>
                        </span>
                      )}

                      {/* Active Workers Tag */}
                      {r.workersActive !== null && r.workersActive !== undefined && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            r.workersActive
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {r.workersActive ? 'Active Workers' : 'Site Abandoned'}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-500">
                      {formatDate(r.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    {r.comment}
                  </p>

                  {/* Photo attachment if available */}
                  {r.photoUrl && (
                    <div className="mb-3">
                      <a
                        href={r.photoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-lg overflow-hidden border border-slate-800 hover:border-cyan-500 transition"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.photoUrl}
                          alt="Field inspection photo"
                          className="h-32 w-48 object-cover"
                        />
                      </a>
                    </div>
                  )}

                  {/* Corroboration Action Button */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                    <button
                      onClick={() => handleCorroborate(r.id)}
                      disabled={hasCorroborated}
                      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition ${
                        hasCorroborated
                          ? 'text-cyan-400 bg-cyan-950/40 cursor-default'
                          : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span>
                        {hasCorroborated ? 'Corroborated' : 'Corroborate report'} (
                        {totalCorroborations})
                      </span>
                    </button>
                    <span className="text-[10px] text-slate-500">
                      Protected by SHA-256 Anti-Spam
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-slate-950/40">
            <MessageSquare className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">
              No Citizen Eyewitness Reports Yet
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
              Are you located near this project site in {project.province?.name}?
              Help your community by submitting a photo and rating the construction ground reality.
            </p>
            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-cyan-500 transition"
            >
              <Camera className="h-4 w-4" />
              <span>Submit First Eyewitness Report</span>
            </button>
          </div>
        )}
      </div>

      {/* Review Modal Trigger */}
      {isReviewModalOpen && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          projectId={project.id}
          projectName={project.name}
          onClose={() => setIsReviewModalOpen(false)}
          onSuccess={() => {
            setIsReviewModalOpen(false);
            if (onReviewSubmitted) onReviewSubmitted();
          }}
        />
      )}
    </div>
  );
}
