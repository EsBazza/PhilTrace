'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import cytoscape from 'cytoscape';
import { useContractorGraph, useContractors } from '@/hooks/use-projects';
import { formatCurrency, cleanContractorName } from '@/lib/format';

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
  const [filterRisk, setFilterRisk] = useState<'all' | 'high_risk' | 'clean'>('all');
  const [sortBy, setSortBy] = useState<'totalValuePHP' | 'totalContracts' | 'overdueCount' | 'avgProgress'>('totalValuePHP');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Query paginated contractors for leaderboard
  const { data: contractorsData, isLoading: isTableLoading } = useContractors({
    q: searchTerm.trim() || undefined,
    page,
    limit: 15,
    sort: sortBy,
    order: sortOrder,
  });

  // Initialize Cytoscape.js
  useEffect(() => {
    if (!containerRef.current || !graphData?.nodes || graphData.nodes.length === 0) return;

    // Filter nodes for graph clarity
    const nodes = (graphData.nodes as Array<{ data: ContractorNodeData }>).map((n) => {
      const d = n.data;
      const size = Math.max(20, Math.min(70, Math.log10(d.totalValue || 1000000) * 6));
      let bgColor = '#10b981'; // Green
      if (d.overdueCount > 3 || d.terminatedCount > 0) {
        bgColor = '#ef4444'; // Red
      } else if (d.overdueCount > 0) {
        bgColor = '#f59e0b'; // Amber
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
            'font-size': '10px',
            color: '#f3f4f6',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-outline-color': '#111827',
            'text-outline-width': '2px',
            'text-max-width': '100px',
            'text-wrap': 'ellipsis',
            width: 'data(size)',
            height: 'data(size)',
            'border-width': 2,
            'border-color': '#ffffff',
            'border-opacity': 0.8,
            'transition-property': 'background-color, line-color, target-arrow-color, opacity',
            'transition-duration': '0.2s' as any,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#60a5fa',
            'border-opacity': 1,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 'mapData(weight, 1, 10, 1.5, 6)',
            'line-color': '#4b5563',
            opacity: 0.4,
            'curve-style': 'bezier',
          },
        },
        {
          selector: '.highlighted',
          style: {
            opacity: 1,
            'line-color': '#60a5fa',
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

    // Node click handler
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const data = node.data() as ContractorNodeData;
      setSelectedContractor(data);

      // Highlight neighborhood
      cy.elements().removeClass('highlighted').addClass('dimmed');
      node.removeClass('dimmed').addClass('highlighted');
      node.neighborhood().removeClass('dimmed').addClass('highlighted');
    });

    // Background click handler
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
  }, [graphData]);

  const resetGraphView = () => {
    if (cyRef.current) {
      cyRef.current.elements().removeClass('highlighted').removeClass('dimmed');
      cyRef.current.fit(undefined, 40);
      setSelectedContractor(null);
    }
  };

  const contractorsList = contractorsData?.contractors || [];
  const totalPages = contractorsData?.pagination?.totalPages || 1;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/30 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              NATIONAL CONTRACTOR ACCOUNTABILITY REGISTRY
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight">
              Contractor Joint-Venture Network &amp; Leaderboard
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-300 max-w-xl">
              Audit joint-venture co-occurrences, examine historical delays, and identify dominant contractors across 248,000+ public contracts.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/10 shrink-0">
            <div>
              <p className="text-xs text-slate-300 font-medium">Contractor Entities</p>
              <p className="text-2xl font-black text-white mt-0.5">11,162</p>
            </div>
            <div>
              <p className="text-xs text-slate-300 font-medium">Joint-Venture Contracts</p>
              <p className="text-2xl font-black text-amber-400 mt-0.5">73,449</p>
            </div>
          </div>
        </div>
      </div>

      {/* Network Graph Visualizer */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              Joint-Venture Partnership Cluster Graph
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Nodes represent primary contractors. Edges represent shared joint-venture contracts. Click any node to inspect partnerships.
            </p>
          </div>

          {/* Graph Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition"
              title="Zoom Out"
            >
              &minus;
            </button>
            <button
              onClick={resetGraphView}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
            >
              Fit Graph
            </button>
          </div>
        </div>

        {/* Cytoscape Canvas Container */}
        <div className="relative h-[560px] w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner">
          {isGraphLoading ? (
            <div className="flex h-full items-center justify-center text-slate-400">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                <span className="text-xs">Generating joint-venture network...</span>
              </div>
            </div>
          ) : (
            <div ref={containerRef} className="h-full w-full" />
          )}

          {/* Floating Selected Contractor Inspector Card */}
          {selectedContractor && (
            <div className="absolute top-4 left-4 z-10 w-80 rounded-2xl bg-black/85 p-5 text-white backdrop-blur-xl border border-white/20 shadow-2xl animate-in fade-in slide-in-from-left-4 duration-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Selected Contractor</span>
                  <h3 className="text-sm font-bold text-white mt-0.5 line-clamp-2">{selectedContractor.label}</h3>
                </div>
                <button
                  onClick={() => setSelectedContractor(null)}
                  className="rounded-full bg-white/10 p-1 text-gray-400 hover:text-white hover:bg-white/20 transition"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-white/10 p-2.5 border border-white/5">
                  <span className="text-gray-400 text-[10px]">Total Contracts</span>
                  <p className="text-sm font-bold text-white mt-0.5">{selectedContractor.totalContracts}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-2.5 border border-white/5">
                  <span className="text-gray-400 text-[10px]">Overdue Projects</span>
                  <p className={`text-sm font-bold mt-0.5 ${selectedContractor.overdueCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selectedContractor.overdueCount}
                  </p>
                </div>
                <div className="col-span-2 rounded-xl bg-white/10 p-2.5 border border-white/5">
                  <span className="text-gray-400 text-[10px]">Cumulative Contract Value</span>
                  <p className="text-sm font-bold text-indigo-300 mt-0.5">
                    {formatCurrency(selectedContractor.totalValue)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => router.push(`/search?q=${encodeURIComponent(selectedContractor.label)}`)}
                className="mt-4 w-full rounded-xl bg-indigo-600 py-2.5 text-center text-xs font-bold text-white shadow-lg hover:bg-indigo-700 transition"
              >
                Inspect All Won Projects &rarr;
              </button>
            </div>
          )}

          {/* Graph Legend */}
          <div className="absolute bottom-4 right-4 z-10 rounded-xl bg-black/80 p-3 text-xs text-white backdrop-blur-md border border-white/10 shadow-lg">
            <div className="font-bold text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">Network Legend</div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Clean Record (0 Overdue)
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 1–3 Overdue Projects
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> High-Risk (&gt;3 Overdue)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">National Contractor Leaderboard</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Ranked list of contractors by public fund awards, completion rates, and delivery track record.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search contractor name..."
              className="w-full sm:w-72 rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Sort & Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="totalValuePHP">Total Value (₱)</option>
              <option value="totalContracts">Total Award Count</option>
              <option value="overdueCount">Overdue Count</option>
              <option value="avgProgress">Average Progress (%)</option>
            </select>

            <button
              onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              {sortOrder === 'desc' ? '↓ High to Low' : '↑ Low to High'}
            </button>
          </div>

          <div className="text-gray-400 text-[11px]">
            Showing 15 per page
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-600 uppercase tracking-wider font-bold">
              <tr>
                <th className="p-3.5">Contractor Entity</th>
                <th className="p-3.5">Total Awards</th>
                <th className="p-3.5">Cumulative Value (₱)</th>
                <th className="p-3.5">Avg Progress</th>
                <th className="p-3.5">Overdue Flags</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isTableLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="p-4">
                      <div className="h-4 bg-gray-200 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : contractorsList.length > 0 ? (
                contractorsList.map((c) => {
                  const isHighRisk = c.overdueCount > 3;
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50/80 transition ${isHighRisk ? 'bg-red-50/30' : ''}`}>
                      <td className="p-3.5 font-bold text-gray-900 max-w-xs truncate">
                        {c.name}
                      </td>
                      <td className="p-3.5 text-gray-600 font-semibold">
                        {c.totalContracts.toLocaleString()}
                      </td>
                      <td className="p-3.5 font-extrabold text-gray-900">
                        {formatCurrency(c.totalValuePHP)}
                      </td>
                      <td className="p-3.5 font-bold text-blue-600">
                        {typeof c.avgProgress === 'number' ? c.avgProgress.toFixed(1) : 0}%
                      </td>
                      <td className="p-3.5">
                        {c.overdueCount > 0 ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-bold ${
                            isHighRisk ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {c.overdueCount} Overdue
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium">✓ Clean</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => router.push(`/search?q=${encodeURIComponent(c.name)}`)}
                          className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-indigo-600 hover:text-white transition shadow-sm"
                        >
                          Audit Projects &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No contractors found matching &ldquo;{searchTerm}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500">
              Page <span className="font-bold text-gray-900">{page}</span> of{' '}
              <span className="font-bold text-gray-900">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition shadow-sm"
              >
                &larr; Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition shadow-sm"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
