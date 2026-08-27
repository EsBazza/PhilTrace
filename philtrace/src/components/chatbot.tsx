'use client';

import { useState, useRef, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!res.ok) throw new Error('Chat failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let assistantMessage = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data) as { text: string };
              assistantMessage += parsed.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: assistantMessage,
                };
                return updated;
              });
            } catch {
              // Skip unparseable chunks
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [input, isLoading]);

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen && (
        <div className="w-84 sm:w-96 rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col max-h-[540px] overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between bg-[#01367d] px-4 py-3.5 text-white">
            <h3 className="text-sm font-black tracking-wide flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm" />
              MapaTunAI Assistant
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition"
              aria-label="Close Assistant"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px] max-h-[360px] bg-[#f8fafc]">
            {messages.length === 0 && (
              <div className="py-8 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#01367d]/10 text-[#01367d]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-gray-500 max-w-[220px] mx-auto">
                  Ask me about public works, contractors, and project statuses!
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`text-sm rounded-2xl px-3.5 py-2.5 font-medium leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-[#01367d] text-white ml-auto max-w-[85%] rounded-br-none'
                    : 'bg-white text-gray-900 border border-gray-200 mr-auto max-w-[85%] rounded-bl-none'
                }`}
              >
                {msg.content || (
                  <span className="animate-pulse text-gray-500 font-semibold">Analyzing infrastructure data...</span>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="border-t border-gray-200 bg-white p-3 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-[#01367d] focus:ring-2 focus:ring-[#01367d]/20 focus:outline-none transition shadow-inner disabled:bg-gray-50"
              disabled={isLoading}
              autoFocus
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-full bg-[#01367d] px-5 py-2.5 text-sm font-extrabold text-white shadow-md hover:bg-[#ffb241] hover:text-[#01367d] hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:bg-[#01367d] disabled:hover:text-white disabled:scale-100"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Floating Toggle button (only shown when chat is closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-full bg-[#01367d] p-3 text-white shadow-2xl hover:bg-[#ffb241] hover:text-[#01367d] hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center h-14 w-14 border-2 border-white"
          title="Open MapaTunAI Assistant"
          aria-label="Open AI Assistant"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}
    </div>
  );
}
