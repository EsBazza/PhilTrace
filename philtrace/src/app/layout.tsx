import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/query-client';
import { Header } from '@/components/header';
import { Chatbot } from '@/components/chatbot';

export const metadata: Metadata = {
  title: 'PhilTrace — Philippine Infrastructure Transparency',
  description: 'Track, investigate, and report on Philippine public infrastructure projects.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <QueryProvider>
          <Header />
          <main className="mx-auto max-w-7xl px-4 py-6">
            {children}
          </main>
          <Chatbot />
        </QueryProvider>
      </body>
    </html>
  );
}
