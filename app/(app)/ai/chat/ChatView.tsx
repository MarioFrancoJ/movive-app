"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type AiChatDict = ReturnType<typeof useDictionary>["dict"]["ai"]["chat"];

interface ChatMsg {
  id: string;
  role: "user" | "coach";
  content: string;
  timestamp: string;
}

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Simple rule-based responses (fallback when no external AI) ────────────────

function getAIResponse(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes("eat") || lower.includes("nutrition") || lower.includes("food") || lower.includes("diet") || lower.includes("meal")) {
    return "For optimal results, aim to hit your protein target first (around 1.6-2.2g per kg of bodyweight), then fill remaining calories with carbs and fats based on your activity level. Track your meals consistently to stay accountable.";
  }
  if (lower.includes("workout") || lower.includes("train") || lower.includes("exercise") || lower.includes("routine")) {
    return "A good training split depends on your schedule. For 3-4 days per week, try a Push/Pull/Legs or Upper/Lower split. Focus on progressive overload — gradually increasing weight, reps, or sets over time.";
  }
  if (lower.includes("progress") || lower.includes("plateau") || lower.includes("stuck") || lower.includes("results")) {
    return "Plateaus are normal! Try adjusting your training volume, deload for a week, or reassess your calorie intake. Small changes in sleep quality and stress management can also make a big difference.";
  }
  if (lower.includes("motivation") || lower.includes("tired") || lower.includes("lazy") || lower.includes("quit")) {
    return "Remember why you started. On low-motivation days, commit to just showing up — even a 15-minute session maintains your habit. Consistency beats intensity every time.";
  }
  if (lower.includes("recovery") || lower.includes("rest") || lower.includes("sleep") || lower.includes("sore")) {
    return "Recovery is when growth happens. Aim for 7-9 hours of sleep, stay hydrated, and consider light mobility work on rest days. If you're constantly sore, you may be doing too much volume.";
  }
  if (lower.includes("weight") || lower.includes("fat") || lower.includes("lose") || lower.includes("gain")) {
    return "Weight management comes down to energy balance. For fat loss, aim for a 300-500 calorie deficit. For muscle gain, a 200-300 surplus. Weigh yourself daily and track the weekly average for accurate trends.";
  }

  return "That's a great question! Based on general fitness principles, I'd recommend focusing on consistency with your training and nutrition. Track your progress, adjust when needed, and don't forget recovery. Would you like me to help with something more specific?";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatView() {
  const { dict } = useDictionary();
  const t = dict.ai.chat;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadChat() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setInitialLoading(false); return; }

      const { data } = await supabase
        .from("ai_chat_messages")
        .select("id, role, content, timestamp")
        .eq("user_id", user.id)
        .eq("channel", "ai_chat")
        .order("timestamp", { ascending: true });

      if (data && data.length > 0) {
        setMessages(data.map((m) => ({ id: m.id, role: m.role as "user" | "coach", content: m.content, timestamp: m.timestamp })));
      } else {
        // Create welcome message
        const welcome: ChatMsg = { id: "welcome", role: "coach", content: t.welcomeMessage, timestamp: new Date().toISOString() };
        setMessages([welcome]);
        await supabase.from("ai_chat_messages").insert({ user_id: user.id, role: "coach", content: welcome.content, channel: "ai_chat" });
      }

      setInitialLoading(false);
    }
    loadChat();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userContent = input.trim();
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: userContent, timestamp: new Date().toISOString() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Save user message
      await supabase.from("ai_chat_messages").insert({ user_id: user.id, role: "user", content: userContent, channel: "ai_chat" });

      // Generate response (rule-based fallback)
      const responseContent = getAIResponse(userContent);
      const assistantMsg: ChatMsg = { id: crypto.randomUUID(), role: "coach", content: responseContent, timestamp: new Date().toISOString() };

      // Save coach response
      await supabase.from("ai_chat_messages").insert({ user_id: user.id, role: "coach", content: responseContent, channel: "ai_chat" });

      setMessages([...updated, assistantMsg]);
    } catch {
      const errorMsg: ChatMsg = { id: crypto.randomUUID(), role: "coach", content: t.errorMessage, timestamp: new Date().toISOString() };
      setMessages([...updated, errorMsg]);
    }

    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  async function handleClear() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("ai_chat_messages").delete().eq("user_id", user.id).eq("channel", "ai_chat");
    const welcome: ChatMsg = { id: "welcome", role: "coach", content: t.chatClearedMessage, timestamp: new Date().toISOString() };
    await supabase.from("ai_chat_messages").insert({ user_id: user.id, role: "coach", content: welcome.content, channel: "ai_chat" });
    setMessages([welcome]);
  }

  if (initialLoading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/ai" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">&larr;</Link>
          <div>
            <h1 className="text-lg font-bold text-zinc-900">{t.headerTitle}</h1>
            <p className="text-xs text-zinc-400">{t.headerSubtitle}</p>
          </div>
        </div>
        <button type="button" onClick={handleClear} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
          {t.clearChat}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={["max-w-[80%] rounded-2xl px-4 py-3",
                msg.role === "user" ? "bg-primary text-white" : "border border-zinc-200 bg-white text-zinc-800 shadow-sm",
              ].join(" ")}>
                {msg.role === "coach" && (
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-blue-100 text-xs">AI</span>
                    <span className="text-xs font-semibold text-zinc-400">{t.coachBadge}</span>
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <p className={`mt-1 text-xs ${msg.role === "user" ? "text-zinc-400" : "text-zinc-300"}`}>{timeStr(msg.timestamp)}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-zinc-100 pt-4">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={t.inputPlaceholder} aria-label="Message" disabled={loading}
            className="h-10 flex-1 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:opacity-50" />
          <button type="button" onClick={handleSend} disabled={!input.trim() || loading}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
            {t.sendButton}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[t.suggestionEat, t.suggestionWorkout, t.suggestionProgress, t.suggestionMotivation].map((q) => (
            <button key={q} type="button" onClick={() => setInput(q)}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 hover:border-zinc-400">
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
