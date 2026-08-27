'use client';

import { usePathname } from 'next/navigation';

export function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreenRoute = pathname === '/map' || pathname === '/nearby';
  const isFullWidthPage = pathname === '/' || pathname === '/contractors';

  if (isFullscreenRoute) {
    return (
      <main className="w-full h-[calc(100vh-65px)] overflow-hidden p-0 m-0">
        {children}
      </main>
    );
  }

  if (isFullWidthPage) {
    return (
      <main className="w-full p-0 m-0 overflow-x-hidden bg-[#f4f6fb]">
        {children}
      </main>
    );
  }

  return (
    <main className="w-full px-4 sm:px-8 py-8 min-h-[calc(100vh-65px)] bg-[#eeeeee]">
      {children}
    </main>
  );
}
