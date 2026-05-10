"use client";

import { useState } from "react";
import Image from "next/image";
import { ASSET_BASE } from "@/lib/brand";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "agent"; content: string }[]>([
    { role: "agent", content: "Hi! Looking for a specific cake or need help with a custom order?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history: messages }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "agent", content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "agent", content: "Sorry, the kitchen is a bit busy! Try again in a moment." }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "agent", content: "Connection error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isOpen && (
          <div className="mb-4 w-[350px] overflow-hidden rounded-3xl border border-white/20 bg-cream-50/90 backdrop-blur-xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] transition-all duration-300 flex flex-col h-[450px] animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between bg-happy-blue-900/95 backdrop-blur-md px-5 py-4 text-cream-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative h-9 w-9 overflow-hidden rounded-full bg-cream-100 flex items-center justify-center p-1 shadow-inner">
                  <Image src={`${ASSET_BASE}/logo/happy-cake-logo-256.png`} alt="Happy Cake" fill sizes="36px" className="object-contain p-1" />
                </div>
                <div>
                  <h3 className="font-display text-lg tracking-tight leading-tight">Saule</h3>
                  <p className="text-[10px] uppercase tracking-widest text-cream-200/80">Assistant</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-cream-50/70 hover:text-cream-50 hover:bg-white/10 rounded-full p-1.5 transition-colors active:scale-90">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex max-w-[85%] flex-col ${msg.role === "user" ? "self-end ml-auto items-end" : "self-start items-start"}`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.role === "user" ? "bg-happy-blue-700 text-cream-50 rounded-br-sm" : "bg-white border border-happy-blue-900/5 text-text-primary rounded-bl-sm"}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="self-start max-w-[85%] rounded-2xl rounded-bl-sm bg-white border border-happy-blue-900/5 px-4 py-2.5 text-sm text-text-primary/50 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-text-primary/40 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-text-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-1.5 h-1.5 bg-text-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                </div>
              )}
            </div>

            <div className="border-t border-happy-blue-900/5 p-3 bg-white/50 shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2 relative">
                <input
                  type="text"
                  placeholder="Ask about a cake..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full rounded-full border border-happy-blue-900/10 bg-white px-4 py-2.5 text-sm focus:border-happy-blue-500 focus:outline-none focus:ring-2 focus:ring-happy-blue-500/20 transition-all shadow-sm"
                />
                <button type="submit" disabled={!input.trim() || isLoading} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-happy-blue-700 text-cream-50 disabled:bg-happy-blue-700/50 hover:bg-happy-blue-500 transition-colors shadow-md active:scale-95 absolute right-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-[-2px]"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                </button>
              </form>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_20px_-6px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_25px_-6px_rgba(0,0,0,0.4)] active:scale-90 active:translate-y-0 ${isOpen ? 'bg-happy-blue-900 text-cream-50' : 'bg-happy-blue-700 text-cream-50'}`}
          aria-label="Toggle chat"
        >
          {isOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
          )}
        </button>
      </div>
    </>
  );
}
