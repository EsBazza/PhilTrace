'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';

interface SearchResultProject {
  id: string;
  name: string;
  category: string;
  status: string;
  budgetPHP: number;
  province?: { name: string };
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResultProject[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch auto-complete suggestions on query change
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/projects?q=${encodeURIComponent(trimmed)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.projects || []);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Search bar autocomplete error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setIsOpen(false);
      if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router]
  );

  const handleSelectProject = (projectId: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(`/map?project=${encodeURIComponent(projectId)}`);
  };

  return (
    <div ref={dropdownRef} className="relative w-full max-w-md">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            placeholder="Search projects, contract IDs, or location..."
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="block h-3.5 w-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            </div>
          )}
        </div>
      </form>

      {/* Auto-complete Dropdown Menu */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden text-xs">
          <div className="bg-gray-50 px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 flex items-center justify-between">
            <span>Matching Infrastructure Projects</span>
            <span className="text-blue-600">Click to focus on Map</span>
          </div>

          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectProject(p.id)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/70 transition flex items-start justify-between gap-2 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 mb-0.5">
                    <span className="text-blue-600 font-mono font-bold">{p.id}</span>
                    <span>•</span>
                    <span>{p.province?.name || 'DPWH'}</span>
                  </div>
                  <div className="font-bold text-gray-900 group-hover:text-blue-600 transition truncate">
                    {p.name}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-extrabold text-blue-700">{formatCurrency(p.budgetPHP)}</div>
                  <span className="inline-block text-[10px] text-gray-500">{p.status}</span>
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            className="w-full text-center py-2 bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition border-t border-gray-100"
          >
            See all results for &ldquo;{query}&rdquo; &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
