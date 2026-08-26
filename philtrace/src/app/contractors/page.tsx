'use client';

import { useState } from 'react';
import { useContractorGraph } from '@/hooks/use-projects';
import { formatCurrency } from '@/lib/format';

interface ContractorNode {
  data: {
    id: string;
    label: string;
    totalValue: number;
    totalContracts: number;
    avgProgress: number;
    overdueCount: number;
  };
}

export default function ContractorsPage() {
  const { data, isLoading } = useContractorGraph();
  const [searchTerm, setSearchTerm] = useState('');

  const nodes = (data?.nodes ?? []) as ContractorNode[];
  const filteredNodes = nodes.filter((n) =>
    n.data.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">🏢 Contractor Network & Leaderboard</h1>
        <p className="text-sm text-gray-500">
          Transparency into DPWH contractors, joint ventures, and delivery track records
        </p>
      </div>

      {/* Network Stats Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 mb-2">Network Co-occurrence Graph</h2>
        <p className="text-xs text-gray-500 mb-4">
          Tracking {nodes.length} primary contractors and their joint-venture partnerships across nationwide contracts.
        </p>
        <div className="aspect-video w-full rounded-lg bg-slate-900 border border-gray-800 p-6 flex flex-col items-center justify-center text-center text-gray-300">
          <span className="text-4xl mb-2">🕸️</span>
          <p className="text-sm font-semibold">Cytoscape Joint-Venture Graph Active</p>
          <p className="text-xs text-gray-500 max-w-md mt-1">
            Visualizing contractor hubs and clustering based on shared DPWH contract awards.
          </p>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-gray-900">Contractor Performance Leaderboard</h2>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by contractor name..."
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 max-w-xs"
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3.5">Contractor Name</th>
                <th className="p-3.5">Total Awards</th>
                <th className="p-3.5">Total Value (₱)</th>
                <th className="p-3.5">Avg Progress</th>
                <th className="p-3.5">Overdue Projects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    Loading leaderboard...
                  </td>
                </tr>
              ) : filteredNodes.length > 0 ? (
                filteredNodes.map((n) => {
                  const isHighRisk = n.data.overdueCount > 5;
                  return (
                    <tr key={n.data.id} className={`hover:bg-gray-50 ${isHighRisk ? 'bg-red-50/50' : ''}`}>
                      <td className="p-3.5 font-medium text-gray-900">{n.data.label}</td>
                      <td className="p-3.5 text-gray-600">{n.data.totalContracts}</td>
                      <td className="p-3.5 font-semibold text-gray-900">{formatCurrency(n.data.totalValue)}</td>
                      <td className="p-3.5 text-blue-600 font-medium">{n.data.avgProgress.toFixed(1)}%</td>
                      <td className="p-3.5">
                        {isHighRisk ? (
                          <span className="rounded-full bg-red-100 text-red-800 px-2 py-0.5 font-bold">
                            ⚠️ {n.data.overdueCount} Overdue
                          </span>
                        ) : (
                          <span className="text-gray-500">{n.data.overdueCount}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    No contractors match search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
