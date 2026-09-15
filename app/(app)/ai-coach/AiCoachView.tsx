"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useToast } from "@/components/ui/Toast";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type CoachDict = ReturnType<typeof useDictionary>["dict"]["ai"]["coach"];

type RecommendationCategory = "Nutrition" | "Training" | "Recovery" | "Motivation" | "Consistency";

interface Recommendation {
  id: string;
  category: RecommendationCategory;
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
}

interface DailyCheckIn {
  date: string;
  energyLevel: number;
  sleepQuality: number;
  stressLevel: number;
  motivationLevel: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function categoryColor(c: RecommendationCategory): string {
  switch (c) {
    case "Nutrition":   return "bg-success-light text-success border-border-brand";
    case "Training":    return "bg-blue-50 text-blue-700 border-blue-200";
    case "Recovery":    return "bg-purple-50 text-purple-700 border-purple-200";
    case "Motivation":  return "bg-amber-50 text-amber-700 border-amber-200";
    case "Consistency": return "bg-teal-50 text-teal-700 border-teal-200";
  }
}

function categoryIcon(c: RecommendationCategory): string {
  switch (c) {
    case "Nutrition":   return "🥗";
    case "Training":    return "💪";
    case "Recovery":    return "😴";
    case "Motivation":  return "🔥";
    case "Consistency": return "📈";
  }
}

function priorityBorder(p: "high" | "medium" | "low"): string {
  switch (p) {
    case "high":   return "border-l-4 border-l-red-400";
    case "medium": return "border-l-4 border-l-amber-400";
    case "low":    return "border-l-4 border-l-border-brand";
  }
}

function mapPriority(p: string): "high" | "medium" | "low" {
  if (p === "High" || p === "Critical") return "high";
  if (p === "Medium") return "medium";
  return "low";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AiCoachView() {
  const { success: showToast } = useToast();
  const { dict } = useDictionary();
  const t = dict.ai.coach;
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [checkIn, setCheckIn] = useState<DailyCheckIn | null>(null);
  const [energy, setEnergy] = useState(7);
  const [sleep, setSleep] = useState(7);
  const [stress, setStress] = useState(4);
  const [motivation, setMotivation] = useState(7);
  const [checkInSaved, setCheckInSaved] = useState(false);
  const [stats, setStats] = useState({ workoutsThisWeek: 0, currentStreak: 0 });
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const today = new Date().toISOString().slice(0, 10);

      // Load today's check-in
      const { data: checkInData } = await supabase
        .from("daily_checkins")
        .select("date, energy_level, sleep_quality, stress_level, motivation_level")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (checkInData) {
        const ci: DailyCheckIn = {
          date: checkInData.date,
          energyLevel: checkInData.energy_level,
          sleepQuality: checkInData.sleep_quality,
          stressLevel: checkInData.stress_level,
          motivationLevel: checkInData.motivation_level,
        };
        setCheckIn(ci);
        setEnergy(ci.energyLevel);
        setSleep(ci.sleepQuality);
        setStress(ci.stressLevel);
        setMotivation(ci.motivationLevel);
        setCheckInSaved(true);
      }

      // Load recommendations (active ones)
      const { data: recsData } = await supabase
        .from("recommendations")
        .select("id, category, priority, title, description")
        .eq("user_id", user.id)
        .in("status", ["New", "Viewed"])
        .order("created_at", { ascending: false })
        .limit(6);

      if (recsData) {
        setRecommendations(recsData.map((r) => ({
          id: r.id,
          category: r.category as RecommendationCategory,
          priority: mapPriority(r.priority),
          title: r.title,
          message: r.description,
        })));
      }

      // Load training stats (workouts this week + streak)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekStart = weekAgo.toISOString().slice(0, 10);

      const { data: sessionsData } = await supabase
        .from("training_sessions")
        .select("date, status")
        .eq("user_id", user.id)
        .eq("status", "Completed")
        .order("date", { ascending: false })
        .limit(60);

      if (sessionsData) {
        const thisWeek = sessionsData.filter((s) => s.date >= weekStart);
        setStats((prev) => ({ ...prev, workoutsThisWeek: thisWeek.length }));

        // Calculate streak
        let streak = 0;
        const dates = new Set(sessionsData.map((s) => s.date));
        const d = new Date();
        for (let i = 0; i < 60; i++) {
          const dateStr = d.toISOString().slice(0, 10);
          if (dates.has(dateStr)) { streak++; }
          else if (i > 0) break; // Allow today to not have workout yet
          d.setDate(d.getDate() - 1);
        }
        setStats((prev) => ({ ...prev, currentStreak: streak }));
      }

      setLoading(false);
    }
    loadData();
  }, []);

  async function handleCheckInSave() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().slice(0, 10);

    try {
      if (checkIn) {
        // Update existing
        await supabase
          .from("daily_checkins")
          .update({ energy_level: energy, sleep_quality: sleep, stress_level: stress, motivation_level: motivation })
          .eq("user_id", user.id)
          .eq("date", today);
      } else {
        // Insert new
        await supabase
          .from("daily_checkins")
          .insert({ user_id: user.id, date: today, energy_level: energy, sleep_quality: sleep, stress_level: stress, motivation_level: motivation });
      }

      setCheckIn({ date: today, energyLevel: energy, sleepQuality: sleep, stressLevel: stress, motivationLevel: motivation });
      setCheckInSaved(true);
      showToast(t.checkInSavedToast);
    } catch (err) {
      console.error("Failed to save check-in:", err);
    }
  }

  if (loading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  // Today's focus: highest priority recommendation
  const todaysFocus = recommendations.find((r) => r.priority === "high") || recommendations[0];
  const weeklyGoal = stats.workoutsThisWeek < 3
    ? t.weeklyGoalComplete.replace("{n}", String(3 - stats.workoutsThisWeek))
    : t.weeklyGoalMaintain;

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">{t.subtitle}</p>
          </div>
          <Link href="/ai-coach/chat" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {t.chatWithCoach}
          </Link>
        </div>

        {/* Dashboard Widgets */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.widgetTodaysFocus}</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{todaysFocus?.title || t.focusFallback}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.widgetWeeklyGoal}</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{weeklyGoal}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.widgetCurrentStreak}</p>
            <p className="mt-1 text-xl font-bold text-blue-600">{stats.currentStreak} <span className="text-xs font-normal text-zinc-400">{t.unitDays}</span></p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.widgetThisWeek}</p>
            <p className="mt-1 text-xl font-bold text-zinc-900">{stats.workoutsThisWeek} <span className="text-xs font-normal text-zinc-400">{t.unitWorkouts}</span></p>
          </div>
        </div>

        {/* Daily Check-In */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-900">{t.dailyCheckInHeading}</p>
            {checkInSaved && <span className="text-xs font-medium text-success">{t.savedToday}</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SliderField label={t.sliderEnergy} value={energy} onChange={setEnergy} disabled={checkInSaved} />
            <SliderField label={t.sliderSleep} value={sleep} onChange={setSleep} disabled={checkInSaved} />
            <SliderField label={t.sliderStress} value={stress} onChange={setStress} disabled={checkInSaved} />
            <SliderField label={t.sliderMotivation} value={motivation} onChange={setMotivation} disabled={checkInSaved} />
          </div>

          {!checkInSaved && (
            <button type="button" onClick={handleCheckInSave}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              {t.saveCheckIn}
            </button>
          )}
        </div>

        {/* Recommendations */}
        <div>
          <p className="mb-3 text-sm font-semibold text-zinc-900">{t.recommendationsHeading}</p>
          {recommendations.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
              <p className="text-sm text-zinc-400">{t.recommendationsEmpty}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recommendations.map((rec) => (
                <div key={rec.id} className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${priorityBorder(rec.priority)}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-base">{categoryIcon(rec.category)}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${categoryColor(rec.category)}`}>{rec.category}</span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900">{rec.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">{rec.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
    </>
  );
}

// ── Slider Field ──────────────────────────────────────────────────────────────

function SliderField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-600">{label}</label>
        <span className="text-xs font-bold text-zinc-900">{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        disabled={disabled}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}
