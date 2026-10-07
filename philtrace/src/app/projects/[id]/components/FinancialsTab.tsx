'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  ExternalLink,
  Download,
  Loader2,
  Table as TableIcon,
  Archive,
  Info,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { ProjectDetailData } from '@/hooks/use-projects';

interface FinancialsTabProps {
  project: ProjectDetailData;
}

interface BoqItem {
  id: string;
  itemCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitCostPhp: number;
  totalPhp: number;
  nationalAvgPhp: number | null;
  regionalAvgPhp: number | null;
  variancePct: number | null;
  flagUnitPriceAnomaly: boolean;
}

interface BoqResponse {
  projectId: string;
  extractionStatus: string;
  totalBoqCost: number;
  mobilizationCost: number;
  flagMobilizationInflated: boolean;
  items: BoqItem[];
}

export default function FinancialsTab({ project }: FinancialsTabProps) {
  const [boqData, setBoqData] = useState<BoqResponse | null>(null);
  const [isLoadingBoq, setIsLoadingBoq] = useState<boolean>(true);

  // PDF verification & Wayback fallback
  const rawPdfUrl = project.contractDocument?.sourcePdfUrl || '';


  // 1. Fetch BOQ Items & Benchmarks
  useEffect(() => {
    const controller = new AbortController();

    async function loadBoq() {
      setIsLoadingBoq(true);
      try {
        const res = await fetch(`/api/contracts/${project.id}/boq`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setBoqData(data);
        }
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to load BOQ items:', err);
        }
      } finally {
        setIsLoadingBoq(false);
      }
    }

    loadBoq();

    return () => controller.abort();
  }, [project.id]);

  // Use the raw PDF URL directly without stalled async verification
  const verifiedPdfUrl = rawPdfUrl;

  return (
    <div className="space-y-8">
      {/* SECTION 1: Bill of Quantities (BOQ) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Itemized Bill of Quantities (BOQ)</h3>
          </div>
          {boqData?.flagMobilizationInflated && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Inflated Mobilization (&gt;5% of total budget)</span>
            </span>
          )}
        </div>

        {isLoadingBoq ? (
          <div className="flex h-48 w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400 mr-2" />
            <span className="text-xs text-slate-400">Loading itemized bill of quantities...</span>
          </div>
        ) : boqData && boqData.items && boqData.items.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40 shadow-lg">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Total (₱)</th>
                  <th className="px-4 py-3 text-right">Benchmark Var.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {boqData.items.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-slate-800/40 ${
                      item.flagUnitPriceAnomaly
                        ? 'bg-rose-950/20 text-rose-200'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-200">
                      {item.itemCode}
                    </td>
                    <td className="px-4 py-3 max-w-xs">{item.description}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{item.unit}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(item.unitCostPhp)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                      {formatCurrency(item.totalPhp)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {item.variancePct !== null ? (
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            item.flagUnitPriceAnomaly
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : item.variancePct > 0
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {item.variancePct > 0 ? `+${item.variancePct}%` : `${item.variancePct}%`}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-slate-950/40">
            <Info className="mx-auto h-6 w-6 text-slate-500 mb-2" />
            <p className="text-sm font-medium text-slate-300">
              Itemized BOQ Parsing in Progress
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Scanned PDF contracts are automatically extracted using Google Gemini Flash.
              Refer to the complete scanned contract PDF below for full civil works line items.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 2: Official Scanned Contract PDF Viewer */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-bold text-white">Official Scanned Contract Document</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://transparency.dpwh.gov.ph/?search=${encodeURIComponent(project.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-900/50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>DPWH Transparency Portal ↗</span>
            </a>
            <a
              href={`https://www.dpwh.gov.ph/dpwh/business/procurement/civil-works/contract/${encodeURIComponent(project.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Civil Works Registry ↗</span>
            </a>
            {verifiedPdfUrl && (
              <>
                <a
                  href={verifiedPdfUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-900/50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Original DPWH Contract</span>
                </a>
              </>
            )}
          </div>
        </div>

        {/* Inline PDF Viewer Iframe */}
        {verifiedPdfUrl ? (
          <div className="relative h-[650px] w-full rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
            <iframe
              src={verifiedPdfUrl}
              className="h-full w-full border-0"
              title={`Contract Document ${project.id}`}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-slate-950">
            <FileText className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">
              No Scanned Contract Document URL on Record
            </p>
            <p className="text-xs text-slate-500 mt-1">
              DPWH has not yet uploaded the signed contract PDF for contract ID {project.id}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
