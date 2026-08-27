import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/query-client';
import { Header } from '@/components/header';
import { Chatbot } from '@/components/chatbot';
import { MainLayoutWrapper } from '@/components/main-layout-wrapper';

export const metadata: Metadata = {
  title: "MapaTunAI: Mapping What's Real — Exposing Ghost Projects Across the Philippines",
  description: "MapaTunAI: Mapping What's Real — Exposing Ghost Projects Across the Philippines. Track, investigate, and verify public infrastructure contracts with citizen truth and satellite proof.",
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
