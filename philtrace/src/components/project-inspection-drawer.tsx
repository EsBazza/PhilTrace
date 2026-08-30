'use client';

import { useState, useEffect } from 'react';
import { formatCurrency, formatDate, cleanContractorName } from '@/lib/format';
import { STATUS_COLORS } from '@/lib/constants';
import WaybackSlider from '@/components/wayback-slider';
import StreetViewEmbed from '@/components/street-view-embed';
import ReviewModal from '@/components/review-modal';
import { isWithinReviewRadius, MAX_REVIEW_RADIUS_KM } from '@/lib/geo';

interface ProjectDetail {
  id: string;
  name: string;
  category: string;
  status: string;
  budgetPHP: number;
  amountPaid: number;
  progress: number;
  startDate: string;
  completionDate: string | null;
  gpsLat: number;
  gpsLng: number;
  contractorRaw: string;
  sourceOfFunds?: string | null;
  programName?: string | null;
  infraYear?: string | null;
  hasSatelliteImage: boolean;
  reportCount: number;
  avgRating: number;
  reviewCount: number;
  flagStalled: boolean;
  flagNeverStarted: boolean;
  flagOverdue: boolean;
  flagPaymentPending: boolean;
  flagOverpaid: boolean;
  aiSummary?: string | null;
  province?: {
    name: string;
    region?: { name: string };
  };
}

interface ProjectInspectionDrawerProps {
  projectId: string | null;
  onClose: () => void;
}

interface ReviewItem {
  id: string;
  rating: number;
  createdAt: string;
  phoneVerified?: boolean;
  comment: string;
  photoUrl?: string | null;
  workersActive?: boolean | null;
  corroborations?: number;
}

export default function ProjectInspectionDrawer({
  projectId,
  onClose,
}: ProjectInspectionDrawerProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'wayback' | 'streetview'>('wayback');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Request browser location to check 15km rating eligibility
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, timeout: 8000 }
      );
    }
  }, []);

  const [boqData, setBoqData] = useState<any | null>(null);
  const [connections, setConnections] = useState<any[]>([]);

  // Fetch project details, reviews, BOQ, and contractor connections
  const loadProject = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        const proj = data.project || data;
        setProject(proj);
        setAiSummary(proj?.aiSummary || null);

        // Fetch contractor politician connections
        if (proj?.contractorRaw) {
          fetch(`/api/contractors/${encodeURIComponent(cleanContractorName(proj.contractorRaw))}/connections`)
            .then((cRes) => (cRes.ok ? cRes.json() : null))
            .then((cData) => setConnections(cData?.connections || []))
            .catch(() => {});
        }
      }

      // Fetch BOQ
      fetch(`/api/contracts/${id}/boq`)
        .then((bRes) => (bRes.ok ? bRes.json() : null))
        .then((bData) => setBoqData(bData))
        .catch(() => {});

      const rRes = await fetch(`/api/reviews?projectId=${id}`);
      if (rRes.ok) {
        const rData = await rRes.json();
        setReviews(rData.reviews || []);
      }
    } catch (err) {
      console.error('Failed to load project drawer:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (projectId) {
        loadProject(projectId);
      } else {
        setProject(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [projectId]);

  const handleExplainWithAi = async () => {
    if (!projectId || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.summary);
      }
    } catch (err) {
      console.error('AI summary error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleCorroborate = async (reviewId: string) => {
    try {
      const res = await fetch('/api/reviews/corroborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      });
      if (res.ok && projectId) {
        loadProject(projectId);
      }
    } catch (err) {
      console.error('Corroboration error:', err);
    }
  };

  if (!projectId) return null;

  return (
    <>
      <div className="absolute top-0 left-0 bottom-0 z-30 w-full sm:w-[460px] bg-white shadow-2xl border-r border-gray-200 flex flex-col animate-in slide-in-from-left duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/80 flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                {project?.province?.name ? `${project.province.name}, ${project.province.region?.name || ''}` : 'DPWH Contract'}
              </span>
            </div>
            <h2 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">
              {isLoading ? 'Loading project details...' : project?.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-full bg-white p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 border border-gray-200 transition shrink-0"
            title="Close Drawer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-48 bg-gray-200 rounded-xl" />
              <div className="h-20 bg-gray-200 rounded-xl" />
            </div>
          ) : project ? (
            <>
              {/* Key Score & Status Bar */}
              <div className="flex items-center justify-between bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-amber-500">
                    {project.avgRating > 0 ? project.avgRating.toFixed(1) : '—'}
                  </span>
                  <div>
                    <div className="text-amber-500 text-xs">
                      {'★'.repeat(Math.round(project.avgRating || 0)) + '☆'.repeat(5 - Math.round(project.avgRating || 0))}
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium">
                      {project.reviewCount} citizen {project.reviewCount === 1 ? 'review' : 'reviews'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-800'}`}>
                    {project.status}
                  </span>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">{project.id}</div>
                </div>
              </div>

              {/* Anomaly Badges */}
              {(project.flagOverdue || project.flagOverpaid || project.flagNeverStarted || project.flagStalled || project.flagPaymentPending) && (
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-red-50/70 border border-red-200">
                  {project.flagOverdue && (
                    <span className="rounded-full bg-red-100 text-red-800 px-2 py-0.5 font-bold text-[11px]">
                      Overdue Contract
                    </span>
                  )}
                  {project.flagOverpaid && (
                    <span className="rounded-full bg-red-100 text-red-800 px-2 py-0.5 font-bold text-[11px]">
                      Overpaid &lt;30% Progress
                    </span>
                  )}
                  {project.flagNeverStarted && (
                    <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-bold text-[11px]">
                      Never Started
                    </span>
                  )}
                  {project.flagPaymentPending && (
                    <span className="rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 font-medium text-[11px]">
                      Payment Pending
                    </span>
                  )}
                </div>
              )}

              {/* Visual Proof Section (Wayback Slider vs 360 Street View) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">
                    Visual Ground &amp; Satellite Proof
                  </span>

                  {/* Switcher */}
                  <div className="flex items-center rounded-lg bg-gray-100 p-0.5">
                    <button
                      onClick={() => setActiveMediaTab('wayback')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                        activeMediaTab === 'wayback' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Satellite
                    </button>
                    <button
                      onClick={() => setActiveMediaTab('streetview')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                        activeMediaTab === 'streetview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Street View
                    </button>
                  </div>
                </div>

                {activeMediaTab === 'wayback' ? (
                  <WaybackSlider
                    gpsLat={project.gpsLat}
                    gpsLng={project.gpsLng}
                    startDate={project.startDate}
                    completionDate={project.completionDate}
                  />
                ) : (
                  <StreetViewEmbed
                    gpsLat={project.gpsLat}
                    gpsLng={project.gpsLng}
                    projectName={project.name}
                  />
                )}
              </div>

              {/* Financial & Physical Progress */}
              <div className="rounded-xl border border-gray-200 p-3.5 space-y-3 bg-white shadow-sm">
                <span className="font-bold text-gray-900">Budget &amp; Disbursement Contrast</span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-gray-50 p-2 border border-gray-100">
                    <span className="text-gray-400 text-[10px]">Total Contract Budget</span>
                    <p className="font-bold text-gray-900 mt-0.5">{formatCurrency(project.budgetPHP)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 border border-gray-100">
                    <span className="text-gray-400 text-[10px]">Total Disbursed (Paid)</span>
                    <p className="font-bold text-emerald-600 mt-0.5">{formatCurrency(project.amountPaid)}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Reported Physical Progress</span>
                    <span className="font-bold text-blue-600">{project.progress.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${Math.min(project.progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Dual-Line Payment vs Progress Timeline Chart (Phase 5 A) */}
                {(() => {
                  const disbursementPct = project.budgetPHP > 0 ? (project.amountPaid / project.budgetPHP) * 100 : 0;
                  const progressPct = project.progress || 0;
                  const isSignificantDiscrepancy = disbursementPct - progressPct >= 30;

                  return (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-gray-700">Payment vs. Progress Tracking</span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="flex items-center gap-1 text-red-600 font-bold">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-600" /> Disbursed ({disbursementPct.toFixed(0)}%)
                          </span>
                          <span className="flex items-center gap-1 text-blue-600 font-bold">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" /> Progress ({progressPct.toFixed(0)}%)
                          </span>
                        </div>
                      </div>

                      {/* Discrepancy Annotation Banner */}
                      {isSignificantDiscrepancy && (
                        <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px] font-semibold flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>Disbursement significantly ahead of physical progress at this date (+{(disbursementPct - progressPct).toFixed(0)}% gap).</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Contractor Card */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px]">Awarded Contractor:</span>
                    <p className="font-bold text-gray-800">{cleanContractorName(project.contractorRaw)}</p>
                  </div>
                  <a
                    href={`/search?q=${encodeURIComponent(cleanContractorName(project.contractorRaw))}`}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Track Record &rarr;
                  </a>
                </div>
              </div>

              {/* Gemini AI Executive Summary */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-900">
                    Gemini AI Scope Analysis
                  </span>
                  {!aiSummary && (
                    <button
                      onClick={handleExplainWithAi}
                      disabled={isAiLoading}
                      className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {isAiLoading ? 'Analyzing...' : 'Generate Summary'}
                    </button>
                  )}
                </div>

                {aiSummary ? (
                  <p className="text-xs text-indigo-950 leading-relaxed bg-white/80 p-3 rounded-lg border border-indigo-100">
                    {aiSummary}
                  </p>
                ) : (
                  <p className="text-[11px] text-indigo-700">
                    Click generate to get an instant plain-language breakdown of engineering jargon and citizen sentiment.
                  </p>
                )}
              </div>

              {/* Bill of Quantities (BOQ) Breakdown (Phase 3 & 5 B) */}
              {boqData?.items && boqData.items.length > 0 && (
                <div className="rounded-xl border border-gray-200 p-3.5 space-y-2.5 bg-white shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">Itemized Bill of Quantities (BOQ)</span>
                    <span className="text-[10px] text-gray-500 font-mono">{boqData.items.length} items</span>
                  </div>

                  {boqData.flagMobilizationInflated && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold flex items-center gap-1.5">
                      <span>⚠️</span>
                      <span>Item B.9 Mobilization cost exceeds 5% of contract value.</span>
                    </div>
                  )}

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {boqData.items.map((item: any) => (
                      <div
                        key={item.id}
                        className={`p-2 rounded-lg border text-[11px] ${
                          item.flagUnitPriceAnomaly
                            ? 'bg-red-50/70 border-red-200'
                            : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-gray-700">{item.itemCode}</span>
                            <p className="text-gray-600 line-clamp-1 text-[10px]">{item.description}</p>
                          </div>
                          <span className="font-bold text-gray-900 shrink-0">{formatCurrency(item.totalPhp)}</span>
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                          <span>
                            {item.quantity} {item.unit} &times; {formatCurrency(item.unitCostPhp)}
                          </span>
                          {item.variancePct !== null && (
                            <span
                              className={`font-semibold ${
                                item.flagUnitPriceAnomaly ? 'text-red-700 font-bold' : 'text-gray-600'
                              }`}
                            >
                              {item.variancePct > 0 ? `+${item.variancePct}%` : `${item.variancePct}%`} vs. benchmark
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verified Contractor-Politician Mentions (Phase 6 B) */}
              {connections.length > 0 && (
                <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900">
                      📰 Verified Media &amp; Congressional Mentions
                    </span>
                    <span className="text-[10px] text-purple-600 font-medium">Public Records</span>
                  </div>

                  <p className="text-[10px] text-purple-700 leading-tight">
                    Citations of public reports regarding this contractor. PhilTrace cites sources objectively.
                  </p>

                  <div className="space-y-1.5 pt-1">
                    {connections.map((c) => (
                      <div key={c.id} className="p-2 rounded-lg bg-white/90 border border-purple-100 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="font-bold text-gray-900">{c.connectedName}</span>
                          <p className="text-[10px] text-purple-700">{c.displayText}</p>
                        </div>
                        <a
                          href={c.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-purple-700 hover:underline flex items-center gap-0.5"
                        >
                          View Article &rarr;
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Citizen Reviews & Whistleblower Feed */}
              <div className="space-y-3 pt-2">
                {(() => {
                  const geoCheck =
                    userLocation && project.gpsLat && project.gpsLng
                      ? isWithinReviewRadius(userLocation.lat, userLocation.lng, project.gpsLat, project.gpsLng, MAX_REVIEW_RADIUS_KM)
                      : null;

                  return (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-900">
                          Citizen Reviews ({reviews.length})
                        </span>
                        {geoCheck && (
                          <span
                            className={`text-[10px] font-semibold mt-0.5 inline-flex items-center gap-1 ${
                              geoCheck.isWithin ? 'text-emerald-600' : 'text-amber-700'
                            }`}
                          >
                            <span>{geoCheck.isWithin ? '✓' : '•'}</span>
                            <span>
                              {geoCheck.distanceKm} km away{' '}
                              {geoCheck.isWithin ? '(Within 15 km zone)' : '(Rating restricted to ≤ 15 km)'}
                            </span>
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setIsReviewModalOpen(true)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 shadow-xs ${
                          geoCheck && !geoCheck.isWithin
                            ? 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                        title={
                          geoCheck && !geoCheck.isWithin
                            ? `You are ${geoCheck.distanceKm} km away. Rating is limited to within 15 km.`
                            : ''
                        }
                      >
                        {geoCheck && !geoCheck.isWithin ? 'Rate (Restricted)' : '+ Rate & Review'}
                      </button>
                    </div>
                  );
                })()}

                {reviews.length > 0 ? (
                  <div className="space-y-2.5">
                    {reviews.map((r) => (
                      <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-500 font-bold">
                              {'★'.repeat(Math.round(r.rating))}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {formatDate(r.createdAt)}
                            </span>
                          </div>
                          {r.phoneVerified && (
                            <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                              ✓ Phone Verified
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-800 leading-relaxed">{r.comment}</p>

                        {r.photoUrl && (
                          <a
                            href={r.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg border border-gray-200 hover:border-blue-500 transition group relative"
                            title="Click to view full photo"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={r.photoUrl}
                              alt="Ground observation"
                              className="h-32 w-full object-cover group-hover:scale-105 transition duration-200"
                            />
                            <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-xs font-bold">
                              View Full
                            </span>
                          </a>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-gray-50 text-[11px]">
                          <span className="text-gray-500 font-medium">
                            {r.workersActive === true ? 'Workers Active' : r.workersActive === false ? 'Site Abandoned' : ''}
                          </span>
                          <button
                            onClick={() => handleCorroborate(r.id)}
                            className="text-gray-500 hover:text-blue-600 font-medium flex items-center gap-1"
                          >
                            Corroborate ({r.corroborations || 0})
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-gray-400 space-y-1">
                    <p className="text-xs font-semibold text-gray-600">No citizen reviews yet</p>
                    <p className="text-[11px]">Be the first local citizen to rate and report on this project.</p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Review Modal */}
      {project && (
        <ReviewModal
          projectId={project.id}
          projectName={project.name}
          projectLat={project.gpsLat}
          projectLng={project.gpsLng}
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onSuccess={() => loadProject(project.id)}
        />
      )}
    </>
  );
}
