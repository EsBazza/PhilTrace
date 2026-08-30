'use client';

import { useState, useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { Header } from '@/components/header';

export default function EngineersPage() {
  const [data, setData] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    async function loadGraph() {
      try {
        const res = await fetch('/api/engineers/graph');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to load engineer network:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadGraph();
  }, []);

  useEffect(() => {
    if (!containerRef.current || !data?.nodes || data.nodes.length === 0) return;

    const elements = [
      ...data.nodes.map((n) => ({
        data: {
          ...n.data,
          bgColor: n.data.flagColor || '#3b82f6',
          size: Math.max(30, Math.min(65, 20 + n.data.totalContracts * 4)),
        },
      })),
      ...data.edges.map((e) => ({
        data: {
          ...e.data,
          lineColor: e.data.hasRisk ? '#ef4444' : '#94a3b8',
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(bgColor)',
            label: 'data(label)',
            'font-size': '10px',
            'font-weight': 'bold',
            color: '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-outline-color': '#0f172a',
            'text-outline-width': '2px',
            'text-max-width': '100px',
            'text-wrap': 'ellipsis',
            width: 'data(size)',
            height: 'data(size)',
            'border-width': 2,
            'border-color': '#ffffff',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 'mapData(weight, 1, 10, 1.5, 6)',
            'line-color': 'data(lineColor)',
            opacity: 0.7,
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#f59e0b',
          },
        },
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: () => 100,
        nodeOverlap: 20,
        animate: false,
      } as any,
    });

    cy.on('tap', 'node', (evt) => {
      setSelectedNode(evt.target.data());
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelectedNode(null);
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <span>✍️</span> District Engineer Signature Network
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Cross-referencing DPWH signing district engineers and awarded contractor partnerships across public works contracts.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
              <span className="h-2 w-2 rounded-full bg-blue-600" /> Engineer
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-600" /> Contractor
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> 5+ Contracts
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">
              <span className="h-2 w-2 rounded-full bg-red-600" /> Stalled/Overpaid Pair
            </div>
          </div>
        </div>

        {/* Network Graph Frame */}
        <div className="relative h-[650px] w-full bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Loading District Engineer Signature Graph...
            </div>
          ) : (
            <div ref={containerRef} className="h-full w-full" />
          )}

          {/* Node Inspector Floating Card */}
          {selectedNode && (
            <div className="absolute top-4 right-4 z-20 w-80 bg-white/95 backdrop-blur-md p-4 rounded-xl border border-gray-200 shadow-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  {selectedNode.type === 'engineer' ? 'District Engineer' : 'Awarded Contractor'}
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full`}
                  style={{ backgroundColor: selectedNode.flagColor }}
                />
              </div>

              <h3 className="font-bold text-gray-900 text-sm">{selectedNode.label}</h3>

              {selectedNode.district && (
                <p className="text-gray-600">District: {selectedNode.district}</p>
              )}

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-gray-500">Tracked Contracts:</span>
                <span className="font-black text-gray-900">{selectedNode.totalContracts}</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
