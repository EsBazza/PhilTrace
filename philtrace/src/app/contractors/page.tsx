'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import cytoscape from 'cytoscape';
import { useContractorGraph, useContractors } from '@/hooks/use-projects';
import { formatCurrency } from '@/lib/format';

interface ContractorNodeData {
  id: string;
  label: string;
  totalValue: number;
  totalContracts: number;
  avgProgress: number;
  overdueCount: number;
  terminatedCount: number;
}

export default function ContractorsPage() {
  const router = useRouter();
  const { data: graphData, isLoading: isGraphLoading } = useContractorGraph();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContractor, setSelectedContractor] = useState<ContractorNodeData | null>(null);
  const [sortBy, setSortBy] = useState<'totalValuePHP' | 'totalContracts' | 'overdueCount' | 'avgProgress'>('totalValuePHP');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterRisk, setFilterRisk] = useState<'all' | 'clean' | 'overdue' | 'highrisk'>('all');
  const [activeView, setActiveView] = useState<'cards' | 'network'>('cards');
  const [page, setPage] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Query paginated contractors for leaderboard
  const { data: contractorsData, isLoading: isTableLoading } = useContractors({
    q: searchTerm.trim() || undefined,
    page,
    limit: 12,
    sort: sortBy,
    order: sortOrder,
  });

  // Initialize Cytoscape.js when network view is active
  useEffect(() => {
    if (activeView !== 'network' || !containerRef.current || !graphData?.nodes || graphData.nodes.length === 0) return;

    const nodes = (graphData.nodes as Array<{ data: ContractorNodeData }>).map((n) => {
      const d = n.data;
      const size = Math.max(26, Math.min(75, Math.log10(d.totalValue || 1000000) * 6.5));
      let bgColor = '#10b981'; // Green
      if (d.overdueCount > 3 || d.terminatedCount > 0) {
        bgColor = '#a80101'; // Red
      } else if (d.overdueCount > 0) {
        bgColor = '#ffb241'; // Amber/Gold
      }

      return {
        data: {
          ...d,
          size,
          bgColor,
        },
      };
    });

    const edges = graphData.edges || [];

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(bgColor)',
            label: 'data(label)',
            'font-size': '11px',
            'font-weight': 'bold',
            color: '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-outline-color': '#011438',
            'text-outline-width': '2px',
            'text-max-width': '120px',
            'text-wrap': 'ellipsis',
            width: 'data(size)',
            height: 'data(size)',
            'border-width': 2,
            'border-color': '#ffffff',
            'border-opacity': 0.9,
            'transition-property': 'background-color, line-color, target-arrow-color, opacity',
            'transition-duration': 0.2,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#ffb241',
            'border-opacity': 1,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 'mapData(weight, 1, 10, 1.5, 6)',
            'line-color': '#01367d',
            opacity: 0.5,
            'curve-style': 'bezier',
          },
        },
        {
          selector: '.highlighted',
          style: {
            opacity: 1,
            'line-color': '#ffb241',
            'z-index': 999,
          },
        },
        {
          selector: '.dimmed',
          style: {
            opacity: 0.15,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        randomize: false,
        componentSpacing: 100,
        nodeOverlap: 20,
        idealEdgeLength: 100,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const data = node.data() as ContractorNodeData;
      setSelectedContractor(data);

      cy.elements().removeClass('highlighted').addClass('dimmed');
      node.removeClass('dimmed').addClass('highlighted');
      node.neighborhood().removeClass('dimmed').addClass('highlighted');
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('highlighted').removeClass('dimmed');
        setSelectedContractor(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graphData, activeView]);

  const resetGraphView = () => {
    if (cyRef.current) {
      cyRef.current.elements().removeClass('highlighted').removeClass('dimmed');
      cyRef.current.fit(undefined, 40);
      setSelectedContractor(null);
    }
  };

  const rawContractorsList = contractorsData?.contractors || [];
  const contractorsList = rawContractorsList.filter((c) => {
    if (filterRisk === 'clean') return c.overdueCount === 0 && c.terminatedCount === 0;
    if (filterRisk === 'overdue') return c.overdueCount > 0 && c.overdueCount <= 3;
    if (filterRisk === 'highrisk') return c.overdueCount > 3 || c.terminatedCount > 0;
    return true;
  });

  const totalPages = contractorsData?.pagination?.totalPages || 1;

  // Currently inspected contractor (default to top contractor if none clicked)
  const activeContractor = selectedContractor || (contractorsList.length > 0 ? {
    id: contractorsList[0].id,
    label: contractorsList[0].name,
    totalValue: contractorsList[0].totalValuePHP,
    totalContracts: contractorsList[0].totalContracts,
    avgProgress: contractorsList[0].avgProgress,
    overdueCount: contractorsList[0].overdueCount,
    terminatedCount: contractorsList[0].terminatedCount,
  } : null);

  return (
    <div className="w-full min-h-screen bg-[#f4f6fb] text-gray-900 p-0 m-0 overflow-x-hidden font-sans">
      
      {/* ── Top Header Hero Banner (Klatschboard Premium Style) ──────── */}
      <div className="relative w-full bg-[#011438] text-white px-6 sm:px-12 lg:px-16 pt-10 pb-16 rounded-b-[48px] shadow-2xl border-b border-[#01367d]/40">
        
        {/* Layer 0: Dual Asset Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-screen pointer-events-none rounded-b-[48px]"
          style={{ backgroundImage: "url('/bg2.png')" }}
        />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay pointer-events-none rounded-b-[48px]"
          style={{ backgroundImage: "url('/bg1.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#012456]/95 via-[#01367d]/85 to-[#011438]/95 pointer-events-none rounded-b-[48px]" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          
          {/* Brand & Page Title */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-black text-white border border-white/20 backdrop-blur-md">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffb241] animate-pulse" />
              NATIONAL CONTRACTOR ACCOUNTABILITY REGISTRY
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white uppercase leading-none">
              <span className="text-[#a80101]">MAPA</span>
              <span className="text-[#eeeeee]">TUN</span>
              <span className="text-[#ffb241]">AI</span> Contractors
            </h1>
            <p className="text-sm sm:text-base text-white/85 max-w-2xl font-medium leading-relaxed">
              Explore joint-venture co-occurrences, historical project delays, and dominant contractors across 248,000+ public works contracts.
            </p>
          </div>

          {/* Filter Pills Capsule & Top Right Action CTA */}
          <div className="flex flex-wrap items-center gap-3.5">
            
            {/* Filter Pills Container */}
            <div className="flex items-center bg-white/10 p-1.5 rounded-full border border-white/20 backdrop-blur-md text-xs font-bold shadow-lg">
              <span className="px-3.5 text-white/70 text-[11px] font-black uppercase tracking-wider">Show:</span>
              <button
                onClick={() => setFilterRisk('all')}
                className={`px-4 py-2 rounded-full transition-all duration-200 ${
                  filterRisk === 'all'
                    ? 'bg-white text-[#01367d] font-black shadow-md scale-105'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterRisk('clean')}
                className={`px-4 py-2 rounded-full transition-all duration-200 ${
                  filterRisk === 'clean'
                    ? 'bg-emerald-500 text-white font-black shadow-md scale-105'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                Clean ✓
              </button>
              <button
                onClick={() => setFilterRisk('overdue')}
                className={`px-4 py-2 rounded-full transition-all duration-200 ${
                  filterRisk === 'overdue'
                    ? 'bg-[#ffb241] text-[#01367d] font-black shadow-md scale-105'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                Pending ⚠️
              </button>
              <button
                onClick={() => setFilterRisk('highrisk')}
                className={`px-4 py-2 rounded-full transition-all duration-200 ${
                  filterRisk === 'highrisk'
                    ? 'bg-[#a80101] text-white font-black shadow-md scale-105'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                High Risk ✕
              </button>
            </div>

            {/* View Switcher Toggle Pill */}
            <div className="flex items-center bg-white/10 p-1.5 rounded-full border border-white/20 backdrop-blur-md text-xs font-bold shadow-lg">
              <button
                onClick={() => setActiveView('cards')}
                className={`px-4 py-2 rounded-full transition-all duration-200 ${
                  activeView === 'cards'
                    ? 'bg-[#ffb241] text-[#01367d] font-black shadow-md scale-105'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                List View
              </button>
              <button
                onClick={() => setActiveView('network')}
                className={`px-4 py-2 rounded-full transition-all duration-200 ${
                  activeView === 'network'
                    ? 'bg-[#ffb241] text-[#01367d] font-black shadow-md scale-105'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                Network View
              </button>
            </div>

            {/* Top Right Search Pill CTA */}
            <button
              onClick={() => router.push('/search')}
              className="inline-flex items-center gap-2 rounded-full bg-[#10b981] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-xl hover:bg-emerald-400 hover:scale-105 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search Database
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Split Dashboard Layout ────────────────────────────── */}
      <div className="w-full px-6 sm:px-12 lg:px-16 py-10 max-w-[1800px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

          {/* ── LEFT COLUMN: Contractor Cards Stream (8 Columns) ───────── */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Control Bar: Search & Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="relative flex-1">
                <svg className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search contractor name or keyword..."
                  className="w-full rounded-full border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:border-[#01367d] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#01367d]/20 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-600 shrink-0">
                <span>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'totalValuePHP' | 'totalContracts' | 'overdueCount' | 'avgProgress')}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-[#01367d] focus:border-[#01367d] focus:ring-1 focus:ring-[#01367d] shadow-sm"
                >
                  <option value="totalValuePHP">Total Value (₱)</option>
                  <option value="totalContracts">Award Count</option>
                  <option value="overdueCount">Overdue Flags</option>
                  <option value="avgProgress">Avg Progress (%)</option>
                </select>

                <button
                  onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
                  className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs sm:text-sm font-bold text-[#01367d] hover:bg-[#01367d] hover:text-white transition shadow-sm"
                >
                  {sortOrder === 'desc' ? '↓ High to Low' : '↑ Low to High'}
                </button>
              </div>
            </div>

            {/* List View vs Network View */}
            {activeView === 'network' ? (
              /* Network Graph Visualizer Container */
              <div className="rounded-3xl border border-[#01367d]/20 bg-[#011438] p-6 shadow-2xl text-white space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/15">
                  <div>
                    <h2 className="text-xl font-black text-white">Joint-Venture Network Cluster</h2>
                    <p className="text-xs text-white/70">Click nodes to inspect partner co-occurrences.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}
                      className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/20"
                    >
                      +
                    </button>
                    <button
                      onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
                      className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/20"
                    >
                      &minus;
                    </button>
                    <button
                      onClick={resetGraphView}
                      className="rounded-full bg-[#ffb241] px-4 py-1.5 text-xs font-black text-[#01367d]"
                    >
                      Reset View
                    </button>
                  </div>
                </div>

                <div className="relative h-[600px] w-full rounded-2xl bg-black/60 border border-white/15 overflow-hidden shadow-inner">
                  {isGraphLoading ? (
                    <div className="flex h-full items-center justify-center text-white/70">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#ffb241] border-t-transparent" />
                        <span className="text-xs font-semibold">Generating joint-venture network...</span>
                      </div>
                    </div>
                  ) : (
                    <div ref={containerRef} className="h-full w-full" />
                  )}
                </div>
              </div>
            ) : (
              /* Klatschboard Style List Cards Stream */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-[#01367d] tracking-tight">
                    Contractor Leaderboard ({contractorsList.length} Entities)
                  </h2>
                </div>

                {isTableLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-3xl bg-white p-7 shadow-sm border border-gray-100 space-y-3">
                      <div className="h-5 bg-gray-200 rounded w-1/3" />
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                    </div>
                  ))
                ) : contractorsList.length > 0 ? (
                  contractorsList.map((c, idx) => {
                    const rank = (page - 1) * 12 + idx + 1;
                    const isTop3 = rank <= 3;
                    const isHighRisk = c.overdueCount > 3 || c.terminatedCount > 0;
                    const isPending = c.overdueCount > 0 && c.overdueCount <= 3;
                    const isSelected = activeContractor?.id === c.id || activeContractor?.label === c.name;
                    const progressPct = Math.min(Math.max(c.avgProgress || 0, 0), 100);

                    // Status Bar Accent Color
                    const accentBg = isHighRisk 
                      ? 'bg-[#a80101]' 
                      : isPending 
                      ? 'bg-[#ffb241]' 
                      : 'bg-blue-600';

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedContractor({
                          id: c.id,
                          label: c.name,
                          totalValue: c.totalValuePHP,
                          totalContracts: c.totalContracts,
                          avgProgress: c.avgProgress,
                          overdueCount: c.overdueCount,
                          terminatedCount: c.terminatedCount,
                        })}
                        className={`group relative overflow-hidden rounded-3xl bg-white p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 border cursor-pointer ${
                          isSelected ? 'border-[#01367d] ring-2 ring-[#01367d]/20 bg-blue-50/20 shadow-md' : 'border-gray-200/80 hover:border-[#01367d]/40'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                          
                          {/* Internal Status Accent Bar + Col 1: Award Value & Rank Box */}
                          <div className="flex items-center gap-4 shrink-0">
                            {/* Sleek rounded status accent bar */}
                            <div className={`w-2 h-16 rounded-full shrink-0 ${accentBg} shadow-sm`} />

                            {/* Rank & Award Value Card Box */}
                            <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-4 sm:w-48 text-left shadow-xs">
                              <div className="flex items-center gap-2 mb-1">
                                {isTop3 ? (
                                  <span className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#ffb241] to-amber-400 text-[#01367d] font-black text-xs px-3 py-0.5 shadow-xs">
                                    Rank #{rank}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center rounded-full bg-[#01367d]/10 text-[#01367d] font-black text-xs px-3 py-0.5">
                                    Rank #{rank}
                                  </span>
                                )}
                              </div>
                              <div className="text-xl sm:text-2xl font-black text-[#01367d] tracking-tight">
                                {formatCurrency(c.totalValuePHP)}
                              </div>
                              <div className="text-xs font-bold text-gray-500 mt-0.5">
                                {c.totalContracts.toLocaleString()} Award Contracts
                              </div>
                            </div>
                          </div>

                          {/* Col 2: Avatar & Contractor Entity Name */}
                          <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                            <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-[#01367d] to-[#011438] text-white font-black flex items-center justify-center text-lg shadow-md border-2 border-white">
                              {c.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <h3 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 group-hover:text-[#01367d] transition line-clamp-2 leading-snug">
                                {c.name}
                              </h3>

                              {/* Progress bar + percentage */}
                              <div className="space-y-1 max-w-sm pt-0.5">
                                <div className="flex items-center justify-between text-xs font-extrabold">
                                  <span className="text-gray-500">Avg Completion Rate</span>
                                  <span className="text-blue-600 font-black">{progressPct.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                                  <div
                                    className="h-2 rounded-full transition-all duration-500"
                                    style={{
                                      width: `${progressPct}%`,
                                      backgroundColor: progressPct >= 90 ? '#10b981' : progressPct >= 50 ? '#3b82f6' : '#f59e0b',
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Col 3: Status Badge Pill & Audit Button */}
                          <div className="shrink-0 flex items-center justify-between sm:justify-end gap-3.5 pt-2 sm:pt-0">
                            {c.overdueCount > 0 ? (
                              <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-black shadow-xs ${
                                isHighRisk 
                                  ? 'bg-red-50 text-[#a80101] border border-red-200/80' 
                                  : 'bg-amber-50 text-[#b45309] border border-[#ffb241]/60'
                              }`}>
                                <span className={`h-2.5 w-2.5 rounded-full animate-pulse ${isHighRisk ? 'bg-[#a80101]' : 'bg-[#ffb241]'}`} />
                                {c.overdueCount} Overdue
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-4 py-2 text-xs sm:text-sm font-black shadow-xs">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                Confirmed Clean
                              </span>
                            )}

                            {/* View Projects CTA Pill */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/search?q=${encodeURIComponent(c.name)}`);
                              }}
                              className="rounded-full bg-[#01367d] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md hover:bg-[#ffb241] hover:text-[#01367d] hover:scale-105 transition-all duration-200 whitespace-nowrap"
                            >
                              View Projects &rarr;
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-3xl bg-white p-12 text-center text-gray-500 font-semibold shadow-sm border border-gray-100">
                    No contractors found matching &ldquo;{searchTerm}&rdquo;.
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-200 pt-6">
                    <p className="text-xs sm:text-sm text-gray-600 font-semibold">
                      Page <span className="font-extrabold text-[#01367d]">{page}</span> of <span className="font-extrabold text-[#01367d]">{totalPages}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        className="rounded-full border border-gray-300 bg-white px-5 py-2 text-xs sm:text-sm font-bold text-[#01367d] hover:bg-gray-50 disabled:opacity-50 transition shadow-sm"
                      >
                        &larr; Previous
                      </button>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                        className="rounded-full border border-gray-300 bg-white px-5 py-2 text-xs sm:text-sm font-bold text-[#01367d] hover:bg-gray-50 disabled:opacity-50 transition shadow-sm"
                      >
                        Next &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Klatschboard Sticky Details Panel (4 Columns) ─ */}
          <div className="lg:col-span-4 sticky top-24 space-y-6">
            
            {/* Top Metrics Cards Header */}
            <div className="rounded-3xl bg-white p-7 shadow-md border border-gray-100 space-y-6">
              
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <span className="text-xs font-black uppercase tracking-wider text-gray-400">National Registry Summary</span>
                <span className="text-xs font-black text-[#01367d]">2026 Overview</span>
              </div>

              {/* 3 Metric Badges Row (Klatschboard Style) */}
              <div className="grid grid-cols-3 gap-3 text-center">
                
                {/* Clean Badge */}
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-emerald-500 text-white font-black flex items-center justify-center text-xs shadow-sm mb-1">
                    ✓
                  </div>
                  <span className="text-base sm:text-lg font-black text-emerald-900">5,240</span>
                  <span className="text-xs font-bold text-emerald-700 mt-0.5">Clean</span>
                </div>

                {/* Overdue Badge */}
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-[#ffb241] text-[#01367d] font-black flex items-center justify-center text-xs shadow-sm mb-1">
                    !
                  </div>
                  <span className="text-base sm:text-lg font-black text-amber-900">1,120</span>
                  <span className="text-xs font-bold text-amber-700 mt-0.5">Overdue</span>
                </div>

                {/* Terminated Badge */}
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-100 flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-[#a80101] text-white font-black flex items-center justify-center text-xs shadow-sm mb-1">
                    ✕
                  </div>
                  <span className="text-base sm:text-lg font-black text-red-900">42</span>
                  <span className="text-xs font-bold text-red-700 mt-0.5">Terminated</span>
                </div>
              </div>

              {/* Selected Contractor Detailed Card */}
              {activeContractor ? (
                <div className="pt-4 border-t border-gray-100 space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-black uppercase tracking-wider text-[#ffb241] bg-[#011438] px-4 py-1.5 rounded-full border border-[#01367d]">
                      Contractor Inspector
                    </span>

                    {/* Entity Avatar */}
                    <div className="mx-auto mt-5 h-20 w-20 rounded-2xl bg-[#01367d] text-white font-black text-2xl flex items-center justify-center shadow-lg border-2 border-white">
                      {activeContractor.label.substring(0, 2).toUpperCase()}
                    </div>

                    <h3 className="mt-4 text-base sm:text-lg font-black text-[#01367d] leading-snug">
                      {activeContractor.label}
                    </h3>
                    <p className="text-xs font-semibold text-gray-500 mt-1">
                      Registered DPWH Public Works Contractor
                    </p>
                  </div>

                  {/* Details List */}
                  <div className="space-y-3 pt-2 text-xs sm:text-sm font-medium">
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-500 font-bold">Cumulative Award Value</span>
                      <span className="font-black text-[#01367d] text-sm sm:text-base">{formatCurrency(activeContractor.totalValue)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-500 font-bold">Total Award Contracts</span>
                      <span className="font-extrabold text-gray-900 text-sm sm:text-base">{activeContractor.totalContracts}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-500 font-bold">Avg Completion Rate</span>
                      <span className="font-extrabold text-blue-600 text-sm sm:text-base">{typeof activeContractor.avgProgress === 'number' ? activeContractor.avgProgress.toFixed(1) : 0}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-500 font-bold">Overdue / Delayed Flags</span>
                      <span className={`font-extrabold ${activeContractor.overdueCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {activeContractor.overdueCount > 0 ? `${activeContractor.overdueCount} Overdue` : '0 (Clean)'}
                      </span>
                    </div>
                  </div>

                  {/* Full Projects Button */}
                  <button
                    onClick={() => router.push(`/search?q=${encodeURIComponent(activeContractor.label)}`)}
                    className="w-full mt-4 rounded-full bg-[#01367d] py-3.5 text-center text-xs sm:text-sm font-black text-white shadow-xl hover:bg-[#ffb241] hover:text-[#01367d] hover:scale-105 transition-all duration-200"
                  >
                    View All Won Projects &rarr;
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-gray-400 font-semibold">
                  Click any contractor card to inspect details.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Full-Width Footer with #eeeeee Background & MAPATUNAI.png Asset */}
      <footer className="w-full mt-16 py-16 px-6 md:px-16 bg-[#eeeeee] text-[#01367d] border-t border-[#01367d]/15 space-y-8 text-center shadow-inner">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-center">
            <Image
              src="/MAPATUNAI.png"
              alt="MAPATUNAI Logo"
              width={160}
              height={45}
              className="h-10 w-auto object-contain"
            />
          </div>
          <p className="text-sm text-[#01367d]/80 leading-relaxed font-medium">
            MapaTunAI was engineered by <strong className="text-[#01367d] font-black">UA HOW 2</strong> as a 100% open, public-interest civic technology tool for Philippine governance. Our goal is to provide every Filipino taxpayer with satellite proof and ground-truth data to hold public works accountable.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-bold text-[#01367d]">
          <a href="/map" className="hover:text-[#ffb241] transition-colors">National Map</a>
          <span>•</span>
          <a href="/contractors" className="hover:text-[#ffb241] transition-colors">Contractor Registry</a>
          <span>•</span>
          <a href="/nearby" className="hover:text-[#ffb241] transition-colors">Near Me Scanner</a>
        </div>

        <p className="text-xs text-[#01367d]/60 font-semibold">
          &copy; {new Date().getFullYear()} MapaTunAI by UA HOW 2. All public contract metrics sourced from official DPWH disclosures &amp; verified citizen ground reports.
        </p>
      </footer>
    </div>
  );
}
