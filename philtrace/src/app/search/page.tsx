'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProjects, useContractors, type ProjectWithRelations, type ContractorItem } from '@/hooks/use-projects';
import { formatCurrency, cleanContractorName } from '@/lib/format';
import { STATUS_COLORS, FLAG_COLORS, PROJECT_CATEGORIES } from '@/lib/constants';

const SUGGESTED_QUERIES = [
  'Bridges in Cebu',
  'Flood Control',
  'Overdue projects',
  'Road widening',
  'Bypass road',
  'School building',
  'Metro Manila',
  'Davao City',
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawQuery = searchParams.get('q') ?? searchParams.get('search') ?? '';

  const [inputQuery, setInputQuery] = useState(rawQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'projects' | 'contractors'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedFlag, setSelectedFlag] = useState<string>('All');
  const [projectPage, setProjectPage] = useState<number>(1);
  const [contractorPage, setContractorPage] = useState<number>(1);
  const [projectSort, setProjectSort] = useState<string>('budgetPHP');
  const [projectOrder, setProjectOrder] = useState<string>('desc');

  // Synchronize local input state if URL param changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setInputQuery(rawQuery);
      setProjectPage(1);
      setContractorPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputQuery.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/search');
    }
  };

  const handleQuickSearch = (query: string) => {
    setInputQuery(query);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleClear = () => {
    setInputQuery('');
    router.push('/search');
  };

  // Query projects matching search term
  const {
    data: projectData,
    isLoading: isProjectsLoading,
  } = useProjects({
    q: rawQuery.trim() || undefined,
    page: projectPage,
    limit: activeTab === 'all' ? 6 : 12,
    category: selectedCategory !== 'All' ? selectedCategory : undefined,
    status: selectedStatus !== 'All' ? selectedStatus : undefined,
    flag: selectedFlag !== 'All' ? selectedFlag.toLowerCase() : undefined,
    sort: projectSort,
    order: projectOrder,
  });

  // Query contractors matching search term
  const {
    data: contractorData,
    isLoading: isContractorsLoading,
  } = useContractors({
    q: rawQuery.trim() || undefined,
    page: contractorPage,
    limit: activeTab === 'all' ? 4 : 12,
  });

  const totalProjects = projectData?.pagination?.total ?? 0;
  const totalContractors = contractorData?.pagination?.total ?? 0;
  const totalMatches = totalProjects + totalContractors;

  const projectPages = projectData?.pagination?.totalPages ?? 1;
  const contractorPages = contractorData?.pagination?.totalPages ?? 1;

  const isLoading = isProjectsLoading || isContractorsLoading;
  const hasQuery = rawQuery.trim().length > 0;

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-6">
      {/* Search Header and Input */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="relative flex items-center">
            <svg
              className="absolute left-4 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>

            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Search by project name, contractor, contract ID, region, or keyword..."
              className="w-full rounded-full border border-gray-300 bg-gray-50 py-3.5 pl-12 pr-28 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#01367d] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#01367d]/20"
            />

            <div className="absolute right-2.5 flex items-center gap-1.5">
              {inputQuery && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition"
                  title="Clear search"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                type="submit"
                className="rounded-full bg-[#01367d] px-5 py-2 text-sm font-extrabold text-white shadow-md hover:bg-[#ffb241] hover:text-[#01367d] transition"
              >
                Search
              </button>
            </div>
          </div>

          {/* Quick Search Suggestion Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="font-medium text-gray-500">Popular:</span>
            {SUGGESTED_QUERIES.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleQuickSearch(suggestion)}
                className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Results Header: Total count, tabs & filter chips */}
      {hasQuery && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Search Results
              </h1>
              <p className="text-sm text-gray-500">
                Found <strong className="text-gray-900">{totalMatches.toLocaleString()}</strong> matches for &ldquo;
                <span className="text-blue-600 font-semibold">{rawQuery}</span>&rdquo;
              </p>
            </div>

            {/* Entity Tabs */}
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('all');
                  setProjectPage(1);
                  setContractorPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({totalMatches})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('projects');
                  setProjectPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'projects'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Projects ({totalProjects})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('contractors');
                  setContractorPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'contractors'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Contractors ({totalContractors})
              </button>
            </div>
          </div>

          {/* Filter Chips Bar (Category, Status, Flags, Sort) */}
          {(activeTab === 'all' || activeTab === 'projects') && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3 border border-gray-200">
              <span className="text-xs font-semibold text-gray-700">Filters:</span>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setProjectPage(1);
                }}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All Categories</option>
                {PROJECT_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setProjectPage(1);
                }}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All Statuses</option>
                <option value="On-Going">On-Going</option>
                <option value="Completed">Completed</option>
                <option value="Not Yet Started">Not Yet Started</option>
                <option value="Suspended">Suspended</option>
                <option value="Terminated">Terminated</option>
              </select>

              {/* Flag Filter */}
              <select
                value={selectedFlag}
                onChange={(e) => {
                  setSelectedFlag(e.target.value);
                  setProjectPage(1);
                }}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All Anomaly Flags</option>
                <option value="stalled">Stalled</option>
                <option value="neverStarted">Never Started</option>
                <option value="overdue">Overdue</option>
                <option value="overpaid">Overpaid</option>
                <option value="paymentPending">Payment Pending</option>
              </select>

              {/* Sort Filter */}
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Sort:</span>
                <select
                  value={`${projectSort}-${projectOrder}`}
                  onChange={(e) => {
                    const [sort, order] = e.target.value.split('-');
                    setProjectSort(sort);
                    setProjectOrder(order);
                  }}
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="budgetPHP-desc">Budget: High to Low</option>
                  <option value="budgetPHP-asc">Budget: Low to High</option>
                  <option value="progress-desc">Progress: High to Low</option>
                  <option value="progress-asc">Progress: Low to High</option>
                  <option value="startDate-desc">Start Date: Newest</option>
                  <option value="startDate-asc">Start Date: Oldest</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-4 w-16 rounded-full bg-gray-200" />
                </div>
                <div className="h-3 w-1/2 rounded bg-gray-200" />
                <div className="pt-2 flex justify-between">
                  <div className="h-4 w-20 rounded bg-gray-200" />
                  <div className="h-3 w-16 rounded bg-gray-200" />
                </div>
                <div className="h-2 w-full rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Initial Empty State (No query yet) */}
      {!hasQuery && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Search Philippine Infrastructure Database
          </h2>
          <p className="mt-2 text-sm text-gray-500 max-w-lg mx-auto">
            Find and analyze DPWH projects, check contractor track records, investigate stalled contracts, and track public fund disbursements.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">By Project</h3>
              <p className="mt-1 text-xs text-gray-500">
                Search by name, category (e.g. &ldquo;Flood Control&rdquo;), or contract ID.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">By Contractor</h3>
              <p className="mt-1 text-xs text-gray-500">
                Search construction companies, joint ventures, and evaluate historical completion rates.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">By Location</h3>
              <p className="mt-1 text-xs text-gray-500">
                Find projects by province, city, or region name across all 17 Philippine regions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No Results Empty State (Query present but 0 matches) */}
      {!isLoading && hasQuery && totalMatches === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-4">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            No results found for &ldquo;{rawQuery}&rdquo;
          </h2>
          <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
            We couldn&apos;t find any DPWH projects or contractors matching your query with the current filters.
          </p>

          {/* Search Tips */}
          <div className="mt-6 max-w-md mx-auto rounded-lg bg-gray-50 border border-gray-200 p-4 text-left">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Search Tips:
            </h3>
            <ul className="space-y-1.5 text-xs text-gray-600 list-disc list-inside">
              <li>Check the spelling of project names or contractor entities</li>
              <li>Try more general keywords (e.g. &ldquo;Bridge&rdquo;, &ldquo;Drainage&rdquo;, &ldquo;Bacolod&rdquo;)</li>
              <li>Reset category or status filters to broaden your search</li>
              <li>Search using DPWH Contract ID or standard contractor keywords</li>
            </ul>
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSelectedStatus('All');
                setSelectedFlag('All');
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Reset Filters
            </button>
            <button
              onClick={handleClear}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              Clear Search
            </button>
          </div>
        </div>
      )}

      {/* Main Results Display */}
      {!isLoading && hasQuery && totalMatches > 0 && (
        <div className="space-y-8">
          {/* CONTRACTORS SECTION (Shown if activeTab is 'all' or 'contractors') */}
          {(activeTab === 'all' || activeTab === 'contractors') && totalContractors > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">Contractors</h2>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                    {totalContractors}
                  </span>
                </div>
                {activeTab === 'all' && totalContractors > 4 && (
                  <button
                    onClick={() => setActiveTab('contractors')}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    View all {totalContractors} contractors &rarr;
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contractorData?.contractors.map((c: ContractorItem) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-gray-900 line-clamp-2">
                        {c.name}
                      </h3>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {c.totalContracts} {c.totalContracts === 1 ? 'contract' : 'contracts'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-gray-500">Total Portfolio Value:</span>
                      <span className="font-bold text-gray-900">
                        {formatCurrency(c.totalValuePHP)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-gray-500">Avg Completion:</span>
                      <span className="font-semibold text-gray-800">
                        {typeof c.avgProgress === 'number' ? c.avgProgress.toFixed(1) : 0}%
                      </span>
                    </div>

                    {/* Overdue / Terminated flags */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5 text-xs">
                      {c.overdueCount > 0 && (
                        <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-red-700 font-medium">
                          {c.overdueCount} Overdue
                        </span>
                      )}
                      {c.terminatedCount > 0 && (
                        <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-700 font-medium">
                          {c.terminatedCount} Terminated
                        </span>
                      )}
                      {c.overdueCount === 0 && c.terminatedCount === 0 && (
                        <span className="text-gray-400">Clean track record</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Contractors Pagination (when on contractors tab) */}
              {activeTab === 'contractors' && contractorPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-500">
                    Showing page <span className="font-semibold text-gray-900">{contractorPage}</span> of{' '}
                    <span className="font-semibold text-gray-900">{contractorPages}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={contractorPage <= 1}
                      onClick={() => setContractorPage((prev) => Math.max(prev - 1, 1))}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      &larr; Previous
                    </button>
                    <button
                      disabled={contractorPage >= contractorPages}
                      onClick={() => setContractorPage((prev) => Math.min(prev + 1, contractorPages))}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PROJECTS SECTION (Shown if activeTab is 'all' or 'projects') */}
          {(activeTab === 'all' || activeTab === 'projects') && totalProjects > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">Infrastructure Projects</h2>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                    {totalProjects}
                  </span>
                </div>
                {activeTab === 'all' && totalProjects > 6 && (
                  <button
                    onClick={() => setActiveTab('projects')}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    View all {totalProjects} projects &rarr;
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectData?.projects.map((project: ProjectWithRelations) => {
                  const flags: string[] = [];
                  if (project.flagStalled) flags.push('Stalled');
                  if (project.flagNeverStarted) flags.push('Never Started');
                  if (project.flagOverdue) flags.push('Overdue');
                  if (project.flagOverpaid) flags.push('Overpaid');

                  const statusClass = STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-800';

                  return (
                    <Link
                      key={project.id}
                      href={`/map?project=${project.id}`}
                      className="group flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-xs font-semibold text-gray-500 truncate">
                            {project.province?.name ? `${project.province.name}` : project.id}
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                            {project.status}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition line-clamp-2">
                          {project.name}
                        </h3>

                        <p className="mt-1 text-xs text-gray-500 truncate">
                          {cleanContractorName(project.contractorRaw || 'Unassigned')}
                        </p>

                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-sm font-bold text-gray-900">
                            {formatCurrency(project.budgetPHP)}
                          </span>
                          <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                            {project.category}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span className="font-semibold text-gray-800">
                              {typeof project.progress === 'number' ? project.progress.toFixed(1) : 0}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${Math.min(Math.max(project.progress, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Anomaly flags & Live badge */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-1">
                        {flags.map((flag) => (
                          <span
                            key={flag}
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                              FLAG_COLORS[flag] ?? 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            {flag}
                          </span>
                        ))}
                        {flags.length === 0 && (
                          <span className="text-xs text-gray-400">No anomaly flags</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Projects Pagination (when on projects tab) */}
              {activeTab === 'projects' && projectPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-500">
                    Showing page <span className="font-semibold text-gray-900">{projectPage}</span> of{' '}
                    <span className="font-semibold text-gray-900">{projectPages}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={projectPage <= 1}
                      onClick={() => setProjectPage((prev) => Math.max(prev - 1, 1))}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      &larr; Previous
                    </button>
                    <button
                      disabled={projectPage >= projectPages}
                      onClick={() => setProjectPage((prev) => Math.min(prev + 1, projectPages))}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchLoadingFallback() {
  return (
    <div className="space-y-6">
      <div className="h-16 w-full animate-pulse rounded-xl bg-gray-200" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoadingFallback />}>
      <SearchContent />
    </Suspense>
  );
}
