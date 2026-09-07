'use client';

import { formatCurrency } from '@/lib/format';

interface ProjectFeature {
  properties: Record<string, any>;
}

interface ProjectSidebarProps {
  title: string;
  projects: ProjectFeature[];
  onSelectProject: (id: string) => void;
  onClose: () => void;
}

export default function ProjectSidebar({
  title,
  projects,
  onSelectProject,
  onClose,
}: ProjectSidebarProps) {
  if (projects.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-20 w-80 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200 shadow-xl space-y-2.5 max-h-[calc(100vh-120px)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="font-black text-gray-900 text-xs">
          📍 Projects in {title} ({projects.length})
        </span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 text-xs font-bold"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1.5">
        {projects.map((feat) => {
          const p = feat.properties;
          const id = p.i || p.id;
          const name = p.n || p.name || 'DPWH Project';
          // Budget can be in thousands or raw
          const budget = p.b !== undefined ? (p.b < 10000000 ? p.b * 1000 : p.b) : 0;
          const progress = Number(p.g ?? p.p ?? p.progress ?? 0);
          const category = p.c || p.cat || 'Infrastructure';
          const isRed = p.k === 2 || p.fo || p.fs;
          const isAmber = p.k === 1 || p.fd || p.fn;

          return (
            <button
              key={id}
              onClick={() => onSelectProject(id)}
              className="w-full text-left p-2.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-blue-50/60 hover:border-blue-200 transition text-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-gray-500">{id?.slice(0, 12)}</span>
                <div className="flex items-center gap-1">
                  {isRed && (
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-700">
                      🚨 High Risk
                    </span>
                  )}
                  {!isRed && isAmber && (
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700">
                      🟡 Attention
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-blue-600">{progress.toFixed(0)}%</span>
                </div>
              </div>
              <p className="font-bold text-gray-900 line-clamp-2 text-[11px]">{name}</p>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-emerald-600">{formatCurrency(budget)}</p>
                <span className="text-[9px] text-gray-400 capitalize">{category}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
