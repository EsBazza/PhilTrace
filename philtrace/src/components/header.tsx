import Link from 'next/link';
import { SearchBar } from './search-bar';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-black bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
            MapaTunAI
          </span>
        </Link>

        <div className="hidden sm:block flex-1 max-w-md">
          <SearchBar />
        </div>

        <nav className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-semibold">
          <Link href="/" className="text-gray-600 hover:text-blue-700 whitespace-nowrap">
            About
          </Link>
          <Link
            href="/map"
            className="flex items-center bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-blue-700 whitespace-nowrap transition font-bold"
          >
            Full Map
          </Link>
          <Link href="/nearby" className="text-gray-600 hover:text-blue-700 whitespace-nowrap">
            Near Me
          </Link>
          <Link href="/contractors" className="hidden sm:inline text-gray-600 hover:text-blue-700 whitespace-nowrap">
            Contractors
          </Link>

        </nav>
      </div>

      {/* Mobile search bar */}
      <div className="sm:hidden px-4 pb-3">
        <SearchBar />
      </div>
    </header>
  );
}
