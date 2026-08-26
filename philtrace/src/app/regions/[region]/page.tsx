'use client';

import { use, useState, useMemo } from 'react';
import Link from 'next/link';
import { useProjects } from '@/hooks/use-projects';
import { ProjectCard, ProjectCardSkeleton } from '@/components/project-card';
import { PROJECT_CATEGORIES } from '@/lib/constants';

interface RegionPageProps {
  params: Promise<{ region: string }>;
}

export default function RegionPage({ params }: RegionPageProps) {
  const resolvedParams = use(params);
  const regionName = decodeURIComponent(resolvedParams.region);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedFlag, setSelectedFlag] = useState<string>('');
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [sortField, setSortField] = useState<string>('budgetPHP');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [page, setPage] = useState<number>(1);

  const { data, isLoading, error } = useProjects({
    region: regionName,
    category: selectedCategory === 'All' ? undefined : selectedCategory,
    flag: selectedFlag || undefined,
    province: selectedProvince || undefined,
    sort: sortField,
    order: sortOrder,
    page,
    limit: 18,
  });

  const provinces = useMemo(() => {
    if (!data?.projects) return [];
    const set = new Set<string>();
    for (const p of data.projects) {
      if (p.province?.name) {
        set.add(p.province.name);
      }
    }
    return Array.from(set).sort();
  }, [data?.projects]);

  const flagsList = [
    { label: 'All Projects', value: '' },
    { label: 'Stalled', value: 'stalled' },
    { label: 'Never Started', value: 'neverStarted' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Overpaid', value: 'overpaid' },
    { label: 'Payment Pending', value: 'paymentPending' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <nav className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/" className="hover:text-blue-700">Home</Link>
            <span>/</span>
            <span>Regions</span>
            <span>/</span>
            <span className="font-semibold text-gray-800">{regionName}</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">{regionName} Infrastructure</h1>
          <p className="text-sm text-gray-500">
            {data ? `${data.pagination.total.toLocaleString()} total contracts found` : 'Loading contracts...'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium">Sort by:</label>
          <select
            value={sortField}
            onChange={(e) => {
              setSortField(e.target.value);
              setPage(1);
            }}
            aria-label="Sort by field"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="budgetPHP">Highest Budget</option>
            <option value="progress">Progress %</option>
            <option value="startDate">Start Date</option>
            <option value="updatedAt">Latest Update</option>
          </select>
          <button
            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            title="Toggle Sort Direction"
          >
            {sortOrder === 'desc' ? '↓ High-to-Low' : '↑ Low-to-High'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="space-y-6 lg:col-span-1 bg-white p-4 rounded-lg border border-gray-200 h-fit">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Anomaly Status
            </h3>
            <div className="flex flex-col gap-1.5">
              {flagsList.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setSelectedFlag(f.value);
                    setPage(1);
                  }}
                  className={`text-left px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedFlag === f.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Category
            </h3>
            <div className="flex flex-col gap-1.5">
              {PROJECT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setPage(1);
                  }}
                  className={`text-left px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {provinces.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Province / DEO
              </h3>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedProvince('');
                    setPage(1);
                  }}
                  className={`text-left px-3 py-1.5 rounded-md text-xs font-medium ${
                    selectedProvince === ''
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  All Provinces
                </button>
                {provinces.map((prov) => (
                  <button
                    key={prov}
                    onClick={() => {
                      setSelectedProvince(prov);
                      setPage(1);
                    }}
                    className={`text-left px-3 py-1.5 rounded-md text-xs font-medium truncate ${
                      selectedProvince === prov
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {prov}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="lg:col-span-3 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-700 border border-red-200">
              Failed to load projects. Please try refreshing or adjust filters.
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : data?.projects && data.projects.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>

              {data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 pt-4 text-xs text-gray-600">
                  <span>
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded border border-gray-300 bg-white px-3 py-1 font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page >= data.pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded border border-gray-300 bg-white px-3 py-1 font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg bg-white border border-gray-200 p-12 text-center">
              <span className="text-3xl">🔍</span>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No projects match your filter</h3>
              <p className="mt-1 text-xs text-gray-500">
                Try selecting All Projects or clearing your category / province filters.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
