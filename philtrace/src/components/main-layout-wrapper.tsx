'use client';

import { usePathname } from 'next/navigation';

export function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreenRoute = pathname === '/map' || pathname === '/nearby';

  if (isFullscreenRoute) {
    return (
      <main className="w-full h-[calc(100vh-61px)] overflow-hidden p-0 m-0">
        {children}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {children}
    </main>
  );
}
