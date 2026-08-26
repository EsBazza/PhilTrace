'use client';

import Link from 'next/link';
import { formatCurrency, cleanContractorName } from '@/lib/format';
import { STATUS_COLORS, FLAG_COLORS } from '@/lib/constants';
import type { ProjectWithRelations } from '@/hooks/use-projects';

interface ProjectCardProps {
  project: ProjectWithRelations;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const flags: string[] = [];
  if (project.flagStalled) flags.push('Stalled');
  if (project.flagNeverStarted) flags.push('Never Started');
  if (project.flagOverdue) flags.push('Overdue');
  if (project.flagOverpaid) flags.push('Overpaid');

  const statusClass = STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-800';

  return (
    <Link
      href={`/map?project=${project.id}`}
      className="block rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
          {project.name}
        </h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
          {project.status}
        </span>
      </div>

      <p className="mt-1 text-xs text-gray-500 truncate">
        {cleanContractorName(project.contractorRaw)}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">
          {formatCurrency(project.budgetPHP)}
        </span>
        <span className="text-xs text-gray-500">
          {project.category}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{project.progress.toFixed(1)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all"
            style={{ width: `${Math.min(project.progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Anomaly flag chips */}
      {flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {flags.map((flag) => (
            <span
              key={flag}
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${FLAG_COLORS[flag] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {flag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-5 w-16 rounded-full bg-gray-200" />
      </div>
      <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
      <div className="mt-3 flex justify-between">
        <div className="h-4 w-20 rounded bg-gray-200" />
        <div className="h-3 w-16 rounded bg-gray-200" />
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-gray-200" />
    </div>
  );
}
