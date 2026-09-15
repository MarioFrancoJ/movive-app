"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useSandbox } from "@/contexts/SandboxContext";
import { useToast } from "@/components/ui/Toast";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type StartDict = ReturnType<typeof useDictionary>["dict"]["training"]["start"];

interface WorkoutOption {
  id: string;
  name: string;
  goal: string | null;
  duration: number | null;
  exerciseCount: number;
}

interface SetLog {
  setNumber: number;
  targetReps: number;
  completedReps: number;
  targetWeight: number;
  completedWeight: number;
  completed: boolean;
}

interface ExerciseLog {
  exerciseId: string | null;
  exerciseName: string;
  sets: SetLog[];
}

interface ActiveSession {
  id: string;
  workoutId: string | null;
  workoutName: string;
  startTime: string;
  exerciseLogs: ExerciseLog[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

export default function TrainingStartView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSandbox } = useSandbox();
  const { toast } = useToast();
  const { dict } = useDictionary();
  const t = dict.training.start;
  const [workouts, setWorkouts] = useState<WorkoutOption[]>([]);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [abandonedNotice, setAbandonedNotice] = useState<string | null>(null);

  // Rest timer
  const [restTime, setRestTime] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Session timer
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);

  // ── Load workouts + check active session ──────────────────────────────────

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Check for active sessions (handle multiple stale sessions defensively)
      const { data: activeSessions } = await supabase
        .from("training_sessions")
        .select("id, workout_id, workout_name, start_time")
        .eq("user_id", user.id)
        .eq("status", "In Progress")
        .order("start_time", { ascending: false });

      let sessionToResume: { id: string; workout_id: string | null; workout_name: string | null; start_time: string } | null = null;

      if (activeSessions && activeSessions.length > 0) {
        // Auto-abandon ALL stale sessions (>4 hours)
        const stale = activeSessions.filter(
          (s) => Date.now() - new Date(s.start_time).getTime() > SESSION_TIMEOUT_MS
        );
        const fresh = activeSessions.filter(
          (s) => Date.now() - new Date(s.start_time).getTime() <= SESSION_TIMEOUT_MS
        );

        if (stale.length > 0) {
          // Mark all stale sessions as Abandoned
          for (const s of stale) {
            const startMs = new Date(s.start_time).getTime();
            const elapsedMs = Date.now() - startMs;
            await supabase
              .from("training_sessions")
              .update({
                status: "Abandoned",
                end_time: new Date(startMs + SESSION_TIMEOUT_MS).toISOString(),
                duration_minutes: Math.min(Math.round(elapsedMs / 60000), 240),
              })
              .eq("id", s.id);
          }

          // Show notice for the most recent abandoned session
          const lastAbandoned = stale[0];
          setAbandonedNotice(
            t.abandonedNotice.replace("{name}", lastAbandoned.workout_name || "Session")
          );
        }

        // Only resume the most recent fresh session (if any)
        sessionToResume = fresh.length > 0 ? fresh[0] : null;
      }

      if (sessionToResume) {
        const startMs = new Date(sessionToResume.start_time).getTime();
        const elapsedMs = Date.now() - startMs;

        // Resume active session — load exercise logs from DB
        const { data: logs } = await supabase
          .from("session_exercise_logs")
          .select("id, exercise_id, exercise_name, sort_order, session_set_logs(set_number, target_reps, completed_reps, target_weight, completed_weight, completed)")
          .eq("session_id", sessionToResume.id)
          .order("sort_order");

        if (logs && logs.length > 0) {
          const exerciseLogs: ExerciseLog[] = logs.map((log) => ({
            exerciseId: log.exercise_id,
            exerciseName: log.exercise_name,
            sets: (log.session_set_logs || [])
              .sort((a: { set_number: number }, b: { set_number: number }) => a.set_number - b.set_number)
              .map((s: { set_number: number; target_reps: number | null; completed_reps: number | null; target_weight: number | null; completed_weight: number | null; completed: boolean }) => ({
                setNumber: s.set_number,
                targetReps: s.target_reps || 0,
                completedReps: s.completed_reps || 0,
                targetWeight: Number(s.target_weight) || 0,
                completedWeight: Number(s.completed_weight) || 0,
                completed: s.completed,
              })),
          }));

          setSession({
            id: sessionToResume.id,
            workoutId: sessionToResume.workout_id,
            workoutName: sessionToResume.workout_name || "Workout",
            startTime: sessionToResume.start_time,
            exerciseLogs,
          });

          setElapsed(Math.floor(elapsedMs / 1000));
        }
      }

      // Load user workouts
      const { data: workoutData } = await supabase
        .from("workouts")
        .select("id, name, goal, duration, workout_days(workout_exercises(id))")
        .eq("user_id", user.id)
        .eq("is_template", false)
        .order("created_at", { ascending: false });

      if (workoutData) {
        setWorkouts(workoutData.map((w) => ({
          id: w.id,
          name: w.name,
          goal: w.goal,
          duration: w.duration,
          exerciseCount: w.workout_days?.reduce(
            (sum: number, d: { workout_exercises: { id: string }[] }) => sum + (d.workout_exercises?.length || 0), 0
          ) || 0,
        })));
      }

      setLoading(false);
    }

    loadData();
  }, []);

  // Session elapsed timer
  useEffect(() => {
    if (session) {
      elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
    }
  }, [session]);

  // Rest timer
  useEffect(() => {
    if (restRunning && restTime > 0) {
      timerRef.current = setTimeout(() => setRestTime((t) => t - 1), 1000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    } else if (restRunning && restTime <= 0) {
      setRestRunning(false);
    }
  }, [restRunning, restTime]);

  // ── Start Session ─────────────────────────────────────────────────────────

  const handleSelectWorkout = useCallback(async (workoutId: string) => {
    if (starting) return; // prevent double-start
    setStarting(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast(t.errorSignedIn, "error");
      setStarting(false);
      return;
    }

    // Fetch workout exercises
    const { data: workout, error: workoutErr } = await supabase
      .from("workouts")
      .select("id, name, workout_days(workout_exercises(exercise_id, exercise_name, sets, reps, sort_order))")
      .eq("id", workoutId)
      .single();

    if (workoutErr || !workout) {
      toast(t.errorLoadWorkout, "error");
      setStarting(false);
      return;
    }

    // Flatten exercises from all days
    const allExercises: { exercise_id: string | null; exercise_name: string; sets: number; reps: number; sort_order: number }[] = [];
    for (const day of (workout.workout_days || [])) {
      for (const ex of (day.workout_exercises || [])) {
        allExercises.push(ex);
      }
    }
    allExercises.sort((a, b) => a.sort_order - b.sort_order);

    // Guard: a workout with no exercises can't be trained — send the user to edit it
    if (allExercises.length === 0) {
      toast(t.errorNoExercises, "error");
      setStarting(false);
      router.push(`/workouts/${workout.id}`);
      return;
    }

    // Create training session in Supabase
    const baseSession = {
      user_id: user.id,
      workout_id: workout.id,
      workout_name: workout.name,
      status: "In Progress" as const,
      start_time: new Date().toISOString(),
      date: new Date().toISOString().split("T")[0],
    };

    let newSession: { id: string; start_time: string } | null = null;
    const firstTry = await supabase
      .from("training_sessions")
      .insert({ ...baseSession, is_sandbox: isSandbox })
      .select("id, start_time")
      .single();

    if (firstTry.error) {
      // Fallback: if the is_sandbox column isn't present in this environment,
      // retry the insert without it so the session can still start.
      const retry = await supabase
        .from("training_sessions")
        .insert(baseSession)
        .select("id, start_time")
        .single();
      if (retry.error || !retry.data) {
        console.error("Failed to start training session:", retry.error || firstTry.error);
        toast(t.errorStartMsg.replace("{msg}", (retry.error || firstTry.error)?.message ?? "unknown error"), "error");
        setStarting(false);
        return;
      }
      newSession = retry.data;
    } else {
      newSession = firstTry.data;
    }

    if (!newSession) {
      toast(t.errorStartGeneric, "error");
      setStarting(false);
      return;
    }

    // Create session_exercise_logs + session_set_logs
    const exerciseLogs: ExerciseLog[] = [];

    for (let i = 0; i < allExercises.length; i++) {
      const ex = allExercises[i];

      const { data: logRow } = await supabase
        .from("session_exercise_logs")
        .insert({
          session_id: newSession.id,
          user_id: user.id,
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          sort_order: i,
        })
        .select("id")
        .single();

      if (!logRow) continue;

      const setInserts = Array.from({ length: ex.sets }, (_, si) => ({
        exercise_log_id: logRow.id,
        user_id: user.id,
        set_number: si + 1,
        target_reps: ex.reps,
        completed_reps: 0,
        target_weight: 0,
        completed_weight: 0,
        completed: false,
      }));

      await supabase.from("session_set_logs").insert(setInserts);

      exerciseLogs.push({
        exerciseId: ex.exercise_id,
        exerciseName: ex.exercise_name,
        sets: setInserts.map((s) => ({
          setNumber: s.set_number,
          targetReps: s.target_reps,
          completedReps: 0,
          targetWeight: 0,
          completedWeight: 0,
          completed: false,
        })),
      });
    }

    setSession({
      id: newSession.id,
      workoutId: workout.id,
      workoutName: workout.name,
      startTime: newSession.start_time,
      exerciseLogs,
    });
    setCurrentExIdx(0);
    setElapsed(0);
    setStarting(false);
  }, [starting, isSandbox, router, toast, t]);

  // ── Auto-start from ?workout= param ───────────────────────────────────────
  // Lets other pages deep-link into the training flow for a specific workout.
  // An active session (already loaded into `session`) always takes priority.
  const autoStartRef = useRef(false);
  useEffect(() => {
    if (loading || session || autoStartRef.current) return;
    const workoutParam = searchParams.get("workout");
    if (!workoutParam) return;
    // Only auto-start if the workout belongs to the loaded list (valid + owned)
    if (!workouts.some((w) => w.id === workoutParam)) return;
    autoStartRef.current = true;
    handleSelectWorkout(workoutParam);
  }, [loading, session, workouts, searchParams, handleSelectWorkout]);

  // ── Set Actions ───────────────────────────────────────────────────────────

  function handleSetComplete(exIdx: number, setIdx: number, reps: number, weight: number) {
    if (!session) return;
    const updated = {
      ...session,
      exerciseLogs: session.exerciseLogs.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        return { ...ex, sets: ex.sets.map((set, si) => {
          if (si !== setIdx) return set;
          return { ...set, completedReps: reps, completedWeight: weight, completed: true };
        })};
      }),
    };
    setSession(updated);

    // Start rest timer
    setRestTime(60);
    setRestRunning(true);
  }

  function handleSetUndo(exIdx: number, setIdx: number) {
    if (!session) return;
    const updated = {
      ...session,
      exerciseLogs: session.exerciseLogs.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        return { ...ex, sets: ex.sets.map((set, si) => {
          if (si !== setIdx) return set;
          return { ...set, completed: false };
        })};
      }),
    };
    setSession(updated);
  }

  // ── Finish / Cancel ───────────────────────────────────────────────────────

  async function handleFinish() {
    if (!session) return;
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // Update training_session status
    await supabase
      .from("training_sessions")
      .update({
        status: "Completed",
        end_time: new Date().toISOString(),
        duration_minutes: Math.round(elapsed / 60),
      })
      .eq("id", session.id);

    // Update all set logs with completed data
    const { data: exerciseLogs } = await supabase
      .from("session_exercise_logs")
      .select("id, sort_order")
      .eq("session_id", session.id)
      .order("sort_order");

    if (exerciseLogs) {
      for (let i = 0; i < exerciseLogs.length; i++) {
        const logId = exerciseLogs[i].id;
        const localEx = session.exerciseLogs[i];
        if (!localEx) continue;

        for (const set of localEx.sets) {
          await supabase
            .from("session_set_logs")
            .update({
              completed_reps: set.completedReps,
              completed_weight: set.completedWeight,
              completed: set.completed,
            })
            .eq("exercise_log_id", logId)
            .eq("set_number", set.setNumber);
        }
      }
    }

    setSaving(false);
    router.push(`/training/session/${session.id}`);
  }

  async function handleCancel() {
    if (!session) return;

    const supabase = createClient();
    await supabase
      .from("training_sessions")
      .update({
        status: "Cancelled",
        end_time: new Date().toISOString(),
        duration_minutes: Math.round(elapsed / 60),
      })
      .eq("id", session.id);

    router.push("/training");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  // ── Workout selection screen ───────────────────────────────────────────────
  if (!session) {
    return (
      <div className="flex flex-col gap-6">
        {/* Abandoned session notice */}
        {abandonedNotice && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="mt-0.5 text-lg">⏱️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">{abandonedNotice}</p>
              <p className="mt-0.5 text-xs text-amber-700">{t.abandonedInactive}</p>
            </div>
            <button
              type="button"
              onClick={() => setAbandonedNotice(null)}
              className="shrink-0 rounded-md p-1 text-amber-500 hover:bg-amber-100 hover:text-amber-700"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t.subtitle}</p>
        </div>

        {workouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-20 text-center">
            <span className="mb-4 text-3xl" aria-hidden="true">🏋️</span>
            <p className="mb-1 text-base font-semibold text-zinc-900">{t.emptyTitle}</p>
            <p className="mb-6 max-w-sm text-sm text-zinc-500">
              {t.emptyDescription}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/workouts/new" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover">
                {t.createWorkout}
              </Link>
              <Link href="/training/templates" className="rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
                {t.browseTemplates}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workouts.map((w) => {
              const empty = w.exerciseCount === 0;
              return (
              <button key={w.id} type="button" onClick={() => handleSelectWorkout(w.id)} disabled={starting}
                className="flex flex-col items-start rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60">
                <p className="text-sm font-semibold text-zinc-900">{w.name}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {w.goal || t.custom} · {w.exerciseCount} exercise{w.exerciseCount !== 1 ? "s" : ""}{w.duration ? ` · ${w.duration} min` : ""}
                </p>
                {empty && (
                  <span className="mt-2 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{t.addExercisesToTrain}</span>
                )}
              </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Execution screen ───────────────────────────────────────────────────────
  const currentEx = session.exerciseLogs[currentExIdx];
  const totalSets = session.exerciseLogs.reduce((s, e) => s + e.sets.length, 0);
  const completedSets = session.exerciseLogs.reduce((s, e) => s + e.sets.filter((set) => set.completed).length, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">{session.workoutName}</h1>
          <p className="text-xs text-zinc-400">{t.session.replace("{time}", formatTime(elapsed))}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleCancel} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">{dict.common.cancel}</button>
          <button type="button" onClick={handleFinish} disabled={saving} className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
            {saving ? t.saving : t.finish}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
          <span>{t.setsProgress.replace("{x}", String(completedSets)).replace("{y}", String(totalSets))}</span>
          <span>{totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Rest timer */}
      {restRunning && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div>
            <p className="text-sm font-semibold text-blue-900">{t.restTimer}</p>
            <p className="text-2xl font-bold text-blue-700">{formatTime(restTime)}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRestRunning(false)} className="rounded-md bg-blue-200 px-3 py-1 text-xs font-semibold text-blue-800">{t.pause}</button>
            <button type="button" onClick={() => { setRestRunning(false); setRestTime(0); }} className="rounded-md bg-blue-200 px-3 py-1 text-xs font-semibold text-blue-800">{t.skip}</button>
          </div>
        </div>
      )}

      {/* Exercise tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-1">
        {session.exerciseLogs.map((ex, i) => {
          const done = ex.sets.every((s) => s.completed);
          return (
            <button key={i} type="button" onClick={() => setCurrentExIdx(i)}
              className={[
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                currentExIdx === i ? "bg-primary text-white" : done ? "bg-success-light text-success" : "text-zinc-500 hover:text-zinc-900",
              ].join(" ")}>
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Current exercise */}
      {currentEx && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900">{currentEx.exerciseName}</p>
              <p className="text-xs text-zinc-400">{t.exerciseOf.replace("{i}", String(currentExIdx + 1)).replace("{n}", String(session.exerciseLogs.length))}</p>
            </div>
            <div className="flex gap-2">
              {currentExIdx > 0 && (
                <button type="button" onClick={() => setCurrentExIdx((i) => i - 1)} className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">{t.prev}</button>
              )}
              {currentExIdx < session.exerciseLogs.length - 1 && (
                <button type="button" onClick={() => setCurrentExIdx((i) => i + 1)} className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">{t.next}</button>
              )}
            </div>
          </div>

          {/* Sets table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="pb-2 text-xs font-semibold text-zinc-400">{t.colSet}</th>
                  <th className="pb-2 text-xs font-semibold text-zinc-400">{t.colTarget}</th>
                  <th className="pb-2 text-xs font-semibold text-zinc-400">{t.colReps}</th>
                  <th className="pb-2 text-xs font-semibold text-zinc-400">{t.colWeight}</th>
                  <th className="pb-2 text-xs font-semibold text-zinc-400">{t.colDone}</th>
                </tr>
              </thead>
              <tbody>
                {currentEx.sets.map((set, si) => (
                  <SetRow key={si} set={set} exIdx={currentExIdx} setIdx={si} onComplete={handleSetComplete} onUndo={handleSetUndo} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Set Row Component ─────────────────────────────────────────────────────────

function SetRow({ set, exIdx, setIdx, onComplete, onUndo, t }: {
  set: SetLog; exIdx: number; setIdx: number;
  onComplete: (exIdx: number, setIdx: number, reps: number, weight: number) => void;
  onUndo: (exIdx: number, setIdx: number) => void;
  t: StartDict;
}) {
  const [reps, setReps] = useState(set.completedReps || set.targetReps);
  const [weight, setWeight] = useState(set.completedWeight || set.targetWeight);

  return (
    <tr className={`border-b border-zinc-50 ${set.completed ? "bg-success-light/50" : ""}`}>
      <td className="py-2 text-zinc-600">{set.setNumber}</td>
      <td className="py-2 text-zinc-400">{t.targetReps.replace("{n}", String(set.targetReps))}</td>
      <td className="py-2">
        <input type="number" value={reps} onChange={(e) => setReps(parseInt(e.target.value) || 0)} min={0}
          disabled={set.completed}
          className="h-7 w-14 rounded border border-zinc-200 px-2 text-xs text-zinc-900 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-zinc-300" />
      </td>
      <td className="py-2">
        <input type="number" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} min={0} step={0.5}
          disabled={set.completed}
          className="h-7 w-16 rounded border border-zinc-200 px-2 text-xs text-zinc-900 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-zinc-300" />
      </td>
      <td className="py-2">
        {set.completed ? (
          <button type="button" onClick={() => onUndo(exIdx, setIdx)} className="rounded-md bg-success-light px-2 py-1 text-xs font-semibold text-success hover:bg-success-light">
            {t.setDone}
          </button>
        ) : (
          <button type="button" onClick={() => onComplete(exIdx, setIdx, reps, weight)} className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-200">
            {t.complete}
          </button>
        )}
      </td>
    </tr>
  );
}
