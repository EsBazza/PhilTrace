import Link from 'next/link';
import Image from 'next/image';
import { SearchBar } from './search-bar';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#01367d]/10 bg-[#eeeeee]/95 text-[#01367d] shadow-sm backdrop-blur-md">
      <div className="w-full flex items-center justify-between gap-4 px-6 md:px-12 py-3.5">
        
        {/* Left: Brand Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <Image
            src="/MAPATUNAI.png"
            alt="MAPATUNAI Logo"
            width={160}
            height={45}
            className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
            priority
          />
        </Link>

        {/* Middle: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-bold text-[#01367d]">
          <Link href="/" className="hover:text-[#ffb241] transition-colors whitespace-nowrap">
            Home
          </Link>
          <Link href="/map" className="hover:text-[#ffb241] transition-colors whitespace-nowrap">
            Interactive Map
          </Link>
          <Link href="/nearby" className="hover:text-[#ffb241] transition-colors whitespace-nowrap">
            Near Me
          </Link>
          <Link href="/contractors" className="hover:text-[#ffb241] transition-colors whitespace-nowrap">
            Contractors
          </Link>
        </nav>

        {/* Right: Search Input */}
        <div className="flex items-center gap-3">
          <div className="hidden md:block w-64 lg:w-72">
            <SearchBar />
          </div>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="md:hidden px-6 pb-3 pt-1 border-t border-[#01367d]/10">
        <SearchBar />
      </div>
    </header>
  );
}
