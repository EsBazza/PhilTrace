import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/query-client';
import { Header } from '@/components/header';
import { Chatbot } from '@/components/chatbot';
import { MainLayoutWrapper } from '@/components/main-layout-wrapper';

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
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased overflow-x-hidden">
        <QueryProvider>
          <Header />
          <MainLayoutWrapper>
            {children}
          </MainLayoutWrapper>
          <Chatbot />
        </QueryProvider>
      </body>
    </html>
  );
}
