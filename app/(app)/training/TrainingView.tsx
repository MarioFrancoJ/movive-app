"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrainingStats {
  workoutsThisWeek: number;
  currentStreak: number;
  totalSessions: number;
  totalTrainingTime: number;
}

interface PersonalRecord {
  exerciseName: string;
  highestWeight: number;
  mostReps: number;
}

interface RecentSession {
  id: string;
  workoutName: string;
  date: string;
  durationMinutes: number;
  exerciseCount: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrainingView() {
  const { dict } = useDictionary();
  const t = dict.training;
  const [stats, setStats] = useState<TrainingStats>({ workoutsThisWeek: 0, currentStreak: 0, totalSessions: 0, totalTrainingTime: 0 });
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [activeWorkoutName, setActiveWorkoutName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // 1. Load all sessions for stats (includes In Progress for active detection)
      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("id, date, duration_minutes, status, workout_name, start_time")
        .eq("user_id", user.id)
        .eq("is_sandbox", false)
        .order("date", { ascending: false });

      if (sessions) {
        const completed = sessions.filter((s) => s.status === "Completed");

        // Stats
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split("T")[0];

        const workoutsThisWeek = completed.filter((s) => s.date >= weekAgoStr).length;
        const totalSessions = completed.length;
        const totalTrainingTime = completed.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

        // Streak: count consecutive days with sessions going backwards
        const daySet = new Set(completed.map((s) => s.date));
        let streak = 0;
        for (let i = 0; i < 365; i++) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const key = d.toISOString().split("T")[0];
          if (daySet.has(key)) { streak++; } else if (i > 0) break;
        }

        setStats({ workoutsThisWeek, currentStreak: streak, totalSessions, totalTrainingTime });

        // Recent sessions (top 5)
        setRecentSessions(completed.slice(0, 5).map((s) => ({
          id: s.id,
          workoutName: s.workout_name || "Workout",
          date: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          durationMinutes: s.duration_minutes || 0,
          exerciseCount: 0, // Will enrich below
        })));

        // Check active session — auto-abandon if stale (>4h)
        const active = sessions.find((s) => s.status === "In Progress");
        if (active) {
          const elapsedMs = Date.now() - new Date(active.start_time).getTime();
          const TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours

          if (elapsedMs > TIMEOUT_MS) {
            // Auto-abandon stale session
            await supabase
              .from("training_sessions")
              .update({
                status: "Abandoned",
                end_time: new Date(new Date(active.start_time).getTime() + TIMEOUT_MS).toISOString(),
                duration_minutes: Math.min(Math.round(elapsedMs / 60000), 240),
              })
              .eq("id", active.id);
            // Don't show as active
          } else {
            setHasActiveSession(true);
            setActiveWorkoutName(active.workout_name || "Workout");
          }
        }
      }

      // 2. Load recent sessions with exercise count
      const { data: recentData } = await supabase
        .from("training_sessions")
        .select("id, date, workout_name, duration_minutes, session_exercise_logs(id)")
        .eq("user_id", user.id)
        .eq("status", "Completed")
        .eq("is_sandbox", false)
        .order("date", { ascending: false })
        .limit(5);

      if (recentData) {
        setRecentSessions(recentData.map((s) => ({
          id: s.id,
          workoutName: s.workout_name || "Workout",
          date: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          durationMinutes: s.duration_minutes || 0,
          exerciseCount: s.session_exercise_logs?.length || 0,
        })));
      }

      // 3. Personal records (highest weight per exercise from completed sets)
      const { data: setLogs } = await supabase
        .from("session_set_logs")
        .select("completed_weight, completed_reps, completed, session_exercise_logs!inner(exercise_name, session_id, training_sessions!inner(user_id, status))")
        .eq("user_id", user.id)
        .eq("completed", true);

      if (setLogs && setLogs.length > 0) {
        const prMap = new Map<string, { highestWeight: number; mostReps: number }>();

        for (const log of setLogs) {
          const exName = (log.session_exercise_logs as unknown as { exercise_name: string }).exercise_name;
          const weight = Number(log.completed_weight) || 0;
          const reps = log.completed_reps || 0;

          const existing = prMap.get(exName);
          if (!existing) {
            prMap.set(exName, { highestWeight: weight, mostReps: reps });
          } else {
            if (weight > existing.highestWeight) existing.highestWeight = weight;
            if (reps > existing.mostReps) existing.mostReps = reps;
          }
        }

        const prs = Array.from(prMap.entries())
          .map(([exerciseName, data]) => ({ exerciseName, ...data }))
          .filter((pr) => pr.highestWeight > 0 || pr.mostReps > 0)
          .sort((a, b) => b.highestWeight - a.highestWeight)
          .slice(0, 5);

        setRecords(prs);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t.subtitle}</p>
        </div>
        <Link href="/training/start" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {t.startWorkout}
        </Link>
      </div>

      {/* Active session banner */}
      {hasActiveSession && (
        <Link href="/training/start" className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="text-sm font-semibold text-amber-900">{t.inProgressTitle}</p>
            <p className="text-xs text-amber-700">{activeWorkoutName}</p>
          </div>
          <span className="rounded-lg bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">{t.inProgressResume}</span>
        </Link>
      )}

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-zinc-900">{stats.workoutsThisWeek}</p>
          <p className="text-xs text-zinc-400">{t.thisWeek}</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-blue-600">{stats.currentStreak}</p>
          <p className="text-xs text-zinc-400">{t.dayStreak}</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-zinc-900">{stats.totalSessions}</p>
          <p className="text-xs text-zinc-400">{t.totalWorkouts}</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-success">{Math.round(stats.totalTrainingTime / 60)}h</p>
          <p className="text-xs text-zinc-400">{t.trainingTime}</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/training/start" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-sm font-semibold text-zinc-900">{t.quickStartTitle}</p>
          <p className="text-xs text-zinc-400">{t.quickStartDesc}</p>
        </Link>
        <Link href="/training/history" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-sm font-semibold text-zinc-900">{t.quickHistoryTitle}</p>
          <p className="text-xs text-zinc-400">{t.quickHistoryDesc}</p>
        </Link>
        <Link href="/workouts" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-sm font-semibold text-zinc-900">{t.quickMyWorkoutsTitle}</p>
          <p className="text-xs text-zinc-400">{t.quickMyWorkoutsDesc}</p>
        </Link>
      </div>

      {/* Personal Records */}
      {records.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-zinc-900">{t.personalRecords}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {records.map((pr) => (
              <div key={pr.exerciseName} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 text-sm font-bold">PR</div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-900 truncate">{pr.exerciseName}</p>
                  <p className="text-xs text-zinc-400">
                    {pr.highestWeight > 0 ? `${pr.highestWeight} kg` : ""}{pr.highestWeight > 0 && pr.mostReps > 0 ? " · " : ""}{pr.mostReps > 0 ? `${pr.mostReps} reps` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900">{t.recentSessions}</p>
          <Link href="/training/history" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">{dict.common.viewAll}</Link>
        </div>
        {recentSessions.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-zinc-400">{t.noSessions}</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {recentSessions.map((s) => (
              <Link key={s.id} href={`/training/session/${s.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-zinc-50">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{s.workoutName}</p>
                  <p className="text-xs text-zinc-400">{s.date} · {s.durationMinutes} min</p>
                </div>
                <span className="text-xs text-zinc-400">{t.exercisesSuffix.replace("{n}", String(s.exerciseCount))}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
