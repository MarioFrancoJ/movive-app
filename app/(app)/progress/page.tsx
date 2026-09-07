"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

type ProgressDict = ReturnType<typeof useDictionary>["dict"]["progress"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface BodyMeasurements {
  neck: string;
  chest: string;
  waist: string;
  hips: string;
  leftArm: string;
  rightArm: string;
  leftThigh: string;
  rightThigh: string;
  leftCalf: string;
  rightCalf: string;
}

interface MeasurementRecord {
  id: string;
  date: string;
  weight: string;
  measurements: BodyMeasurements;
}

interface ProfileData {
  currentWeight: number | null;
  goalWeight: number | null;
  startingWeight: number | null;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: string;
}

type MeasurementKey = keyof BodyMeasurements;

// ── Constants ─────────────────────────────────────────────────────────────────

function buildMeasurementLabels(t: ProgressDict): Record<MeasurementKey, string> {
  return {
    neck: t.measurementLabels.neck,
    chest: t.measurementLabels.chest,
    waist: t.measurementLabels.waist,
    hips: t.measurementLabels.hips,
    leftArm: t.measurementLabels.leftArm,
    rightArm: t.measurementLabels.rightArm,
    leftThigh: t.measurementLabels.leftThigh,
    rightThigh: t.measurementLabels.rightThigh,
    leftCalf: t.measurementLabels.leftCalf,
    rightCalf: t.measurementLabels.rightCalf,
  };
}

function buildChartMeasurementOptions(t: ProgressDict): { label: string; keys: MeasurementKey[] }[] {
  return [
    { label: t.chartOptions.waist, keys: ["waist"] },
    { label: t.chartOptions.chest, keys: ["chest"] },
    { label: t.chartOptions.hips, keys: ["hips"] },
    { label: t.chartOptions.arms, keys: ["leftArm", "rightArm"] },
    { label: t.chartOptions.legs, keys: ["leftThigh", "rightThigh"] },
  ];
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function buildPoints(
  data: { label: string; value: number }[],
  width: number,
  height: number,
  padding: number
): { x: number; y: number; label: string; value: number }[] {
  if (data.length === 0) return [];
  const values = data.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  return data.map((d, i) => ({
    x: padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding),
    y: padding + (1 - (d.value - minV) / range) * (height - 2 * padding),
    label: d.label,
    value: d.value,
  }));
}

function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function LineChart({
  data,
  color = "#18181b",
  height = 200,
  emptyText = "No data available",
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  emptyText?: string;
}) {
  const WIDTH = 600;
  const PADDING = 30;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50" style={{ height }}>
        <p className="text-sm text-zinc-400">{emptyText}</p>
      </div>
    );
  }

  const points = buildPoints(data, WIDTH, height, PADDING);
  const path = pointsToPath(points);
  const values = data.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = PADDING + (1 - pct) * (height - 2 * PADDING);
          const val = minV + pct * (maxV - minV);
          return (
            <g key={pct}>
              <line x1={PADDING} y1={y} x2={WIDTH - PADDING} y2={y} stroke="#f4f4f5" strokeWidth={1} />
              <text x={PADDING - 5} y={y + 4} textAnchor="end" className="text-xs" fill="#a1a1aa">
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={`${path} L ${points[points.length - 1].x} ${height - PADDING} L ${points[0].x} ${height - PADDING} Z`}
          fill={color}
          opacity={0.05}
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="white" stroke={color} strokeWidth={2} />
            {data.length <= 14 && (
              <text x={p.x} y={height - 8} textAnchor="middle" className="text-xs" fill="#71717a">
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Achievements logic ────────────────────────────────────────────────────────

function computeAchievements(profile: ProfileData, history: MeasurementRecord[], t: ProgressDict): Achievement[] {
  const totalLost =
    profile.startingWeight !== null && profile.currentWeight !== null
      ? profile.startingWeight - profile.currentWeight
      : 0;

  const daysActive = new Set(history.map((r) => r.date)).size;
  const goalReached =
    profile.goalWeight !== null && profile.currentWeight !== null && profile.currentWeight <= profile.goalWeight;

  const a = t.achievementItems;
  return [
    { id: "first-measurement", title: a.firstMeasurementTitle, description: a.firstMeasurementDesc, unlocked: history.length >= 1, icon: "📏" },
    { id: "5kg-lost", title: a.fiveKgTitle, description: a.fiveKgDesc, unlocked: totalLost >= 5, icon: "🔥" },
    { id: "10kg-lost", title: a.tenKgTitle, description: a.tenKgDesc, unlocked: totalLost >= 10, icon: "💪" },
    { id: "goal-reached", title: a.goalReachedTitle, description: a.goalReachedDesc, unlocked: goalReached, icon: "🎯" },
    { id: "30-days", title: a.thirtyDaysTitle, description: a.thirtyDaysDesc, unlocked: daysActive >= 30, icon: "📅" },
    { id: "90-days", title: a.ninetyDaysTitle, description: a.ninetyDaysDesc, unlocked: daysActive >= 90, icon: "🏆" },
  ];
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ t }: { t: ProgressDict }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white py-20">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-zinc-400" aria-hidden="true">
          <path fillRule="evenodd" d="M12 7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V9.414l-5.293 5.293a1 1 0 0 1-1.414 0L7 12.414l-3.293 3.293a1 1 0 0 1-1.414-1.414l4-4a1 1 0 0 1 1.414 0L10 12.586 14.586 8H13a1 1 0 0 1-1-1Z" clipRule="evenodd" />
        </svg>
      </div>
      <p className="mb-1 text-base font-semibold text-zinc-900">{t.emptyTitle}</p>
      <p className="mb-6 text-sm text-zinc-500">{t.emptyDescription}</p>
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {t.emptyAction}
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const { dict } = useDictionary();
  const t = dict.progress;
  const measurementLabels = useMemo(() => buildMeasurementLabels(t), [t]);
  const chartMeasurementOptions = useMemo(() => buildChartMeasurementOptions(t), [t]);
  const [profile, setProfile] = useState<ProfileData>({ currentWeight: null, goalWeight: null, startingWeight: null });
  const [history, setHistory] = useState<MeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeasurement, setSelectedMeasurement] = useState(0);
  const [photoTab, setPhotoTab] = useState<"front" | "side" | "back">("front");

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // 1. Load profile (weight data)
      const { data: userData } = await supabase
        .from("users")
        .select("weight_kg, goal_weight_kg")
        .eq("id", user.id)
        .single();

      // 2. Load weight entries for starting weight
      const { data: weightEntries } = await supabase
        .from("weight_entries")
        .select("weight_kg, date")
        .order("date", { ascending: true })
        .limit(1);

      const currentWeight = userData?.weight_kg ? Number(userData.weight_kg) : null;
      const goalWeight = userData?.goal_weight_kg ? Number(userData.goal_weight_kg) : null;
      const startingWeight = weightEntries && weightEntries.length > 0
        ? Number(weightEntries[0].weight_kg)
        : currentWeight;

      setProfile({ currentWeight, goalWeight, startingWeight });

      // 3. Load measurement entries
      const { data: measurements } = await supabase
        .from("measurement_entries")
        .select("id, date, weight_kg, neck_cm, chest_cm, waist_cm, hips_cm, left_arm_cm, right_arm_cm, left_thigh_cm, right_thigh_cm, left_calf_cm, right_calf_cm")
        .order("date", { ascending: false });

      if (measurements) {
        setHistory(
          measurements.map((row) => ({
            id: row.id,
            date: row.date,
            weight: row.weight_kg?.toString() || "",
            measurements: {
              neck: row.neck_cm?.toString() || "",
              chest: row.chest_cm?.toString() || "",
              waist: row.waist_cm?.toString() || "",
              hips: row.hips_cm?.toString() || "",
              leftArm: row.left_arm_cm?.toString() || "",
              rightArm: row.right_arm_cm?.toString() || "",
              leftThigh: row.left_thigh_cm?.toString() || "",
              rightThigh: row.right_thigh_cm?.toString() || "",
              leftCalf: row.left_calf_cm?.toString() || "",
              rightCalf: row.right_calf_cm?.toString() || "",
            },
          }))
        );
      }

      setLoading(false);
    }

    loadData();
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => a.date.localeCompare(b.date)),
    [history]
  );

  const latestRecord = history.length > 0 ? history[0] : null;
  const previousRecord = history.length > 1 ? history[1] : null;

  const { currentWeight, goalWeight, startingWeight } = profile;
  const totalChange = currentWeight !== null && startingWeight !== null ? currentWeight - startingWeight : null;
  const percentProgress =
    startingWeight !== null && goalWeight !== null && currentWeight !== null && startingWeight !== goalWeight
      ? Math.min(100, Math.max(0, ((startingWeight - currentWeight) / (startingWeight - goalWeight)) * 100))
      : null;

  // Weight chart data
  const weightChartData = useMemo(() => {
    return sortedHistory
      .filter((r) => r.weight)
      .map((r) => ({
        label: r.date.slice(5),
        value: parseFloat(r.weight),
      }));
  }, [sortedHistory]);

  // Measurement chart data
  const measurementChartData = useMemo(() => {
    const option = chartMeasurementOptions[selectedMeasurement];
    if (!option) return [];
    return sortedHistory
      .filter((r) => option.keys.some((k) => r.measurements[k]))
      .map((r) => {
        const avg =
          option.keys.reduce((sum, k) => sum + (parseFloat(r.measurements[k]) || 0), 0) /
          option.keys.length;
        return { label: r.date.slice(5), value: avg };
      })
      .filter((d) => d.value > 0);
  }, [sortedHistory, selectedMeasurement, chartMeasurementOptions]);

  // Achievements
  const achievements = useMemo(() => computeAchievements(profile, history, t), [profile, history, t]);

  if (loading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  const hasData = history.length > 0 || currentWeight !== null;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t.subtitle}
          </p>
        </div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
        >
          {t.updateMeasurements}
        </Link>
      </div>

      {!hasData ? (
        <EmptyState t={t} />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-zinc-400">{t.startingWeight}</p>
              <p className="text-xl font-bold text-zinc-900">
                {startingWeight !== null ? `${startingWeight} kg` : "—"}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-zinc-400">{t.currentWeight}</p>
              <p className="text-xl font-bold text-zinc-900">
                {currentWeight !== null ? `${currentWeight} kg` : "—"}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-zinc-400">{t.goalWeight}</p>
              <p className="text-xl font-bold text-zinc-900">
                {goalWeight !== null ? `${goalWeight} kg` : "—"}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-zinc-400">{t.totalChange}</p>
              <p
                className={[
                  "text-xl font-bold",
                  totalChange !== null && totalChange < 0
                    ? "text-success"
                    : totalChange !== null && totalChange > 0
                    ? "text-red-500"
                    : "text-zinc-900",
                ].join(" ")}
              >
                {totalChange !== null ? `${totalChange > 0 ? "+" : ""}${totalChange.toFixed(1)} kg` : "—"}
              </p>
            </div>
          </div>

          {/* Weight Progress */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-zinc-900">{t.weightProgress}</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-zinc-50 p-4">
                <p className="text-xs text-zinc-400">{t.current}</p>
                <p className="text-lg font-bold text-zinc-900">{currentWeight !== null ? `${currentWeight} kg` : "—"}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-4">
                <p className="text-xs text-zinc-400">{t.goal}</p>
                <p className="text-lg font-bold text-zinc-900">{goalWeight !== null ? `${goalWeight} kg` : "—"}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-4">
                <p className="text-xs text-zinc-400">{t.lostGained}</p>
                <p className={["text-lg font-bold", totalChange !== null && totalChange < 0 ? "text-success" : totalChange !== null && totalChange > 0 ? "text-red-500" : "text-zinc-900"].join(" ")}>
                  {totalChange !== null ? `${totalChange > 0 ? "+" : ""}${totalChange.toFixed(1)} kg` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-4">
                <p className="text-xs text-zinc-400">{t.progressPct}</p>
                <p className="text-lg font-bold text-blue-600">{percentProgress !== null ? `${percentProgress.toFixed(0)}%` : "—"}</p>
                {percentProgress !== null && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${percentProgress}%` }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Body Measurements Comparison */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-zinc-900">{t.bodyMeasurementsComparison}</p>
            {!latestRecord ? (
              <p className="text-sm text-zinc-400">{t.noMeasurementRecords}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colMeasurement}</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colCurrent}</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colPrevious}</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colDifference}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {(Object.keys(measurementLabels) as MeasurementKey[]).map((key) => {
                      const curr = latestRecord?.measurements[key] ? parseFloat(latestRecord.measurements[key]) : null;
                      const prev = previousRecord?.measurements[key] ? parseFloat(previousRecord.measurements[key]) : null;
                      const diff = curr !== null && prev !== null ? curr - prev : null;
                      return (
                        <tr key={key} className="hover:bg-zinc-50">
                          <td className="px-4 py-2.5 font-medium text-zinc-700">{measurementLabels[key]}</td>
                          <td className="px-4 py-2.5 text-zinc-600">{curr !== null ? `${curr} cm` : "—"}</td>
                          <td className="px-4 py-2.5 text-zinc-600">{prev !== null ? `${prev} cm` : "—"}</td>
                          <td className="px-4 py-2.5">
                            {diff !== null ? (
                              <span className={["inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", diff < 0 ? "bg-success-light text-success" : diff > 0 ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-600"].join(" ")}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)} cm
                              </span>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Weight Chart */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-zinc-900">{t.weightChart}</p>
            <LineChart data={weightChartData} color="#18181b" emptyText={t.weightChartEmpty} />
          </div>

          {/* Measurement Charts */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900">{t.measurementChart}</p>
              <select
                value={selectedMeasurement}
                onChange={(e) => setSelectedMeasurement(Number(e.target.value))}
                aria-label="Select measurement to chart"
                className="h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 lg:h-8"
              >
                {chartMeasurementOptions.map((opt, i) => (
                  <option key={opt.label} value={i}>{opt.label}</option>
                ))}
              </select>
            </div>
            <LineChart data={measurementChartData} color="#2563eb" emptyText={t.measurementChartEmpty} />
          </div>

          {/* Progress Photos */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-zinc-900">{t.progressPhotos}</p>
            <div className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              {(["front", "side", "back"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPhotoTab(tab)}
                  className={["min-h-[44px] rounded-md px-4 py-1.5 text-xs font-semibold capitalize transition-colors lg:min-h-0", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300", photoTab === tab ? "bg-primary text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"].join(" ")}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-56 w-full items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50">
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8" aria-hidden="true">
                      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 0 0-1.06 0L2.5 11.06Zm12.22-4.81a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-medium">{t.firstPhoto}</span>
                  </div>
                </div>
                <p className="text-xs font-medium text-zinc-500">First ({photoTab})</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-56 w-full items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50">
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8" aria-hidden="true">
                      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 0 0-1.06 0L2.5 11.06Zm12.22-4.81a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-medium">{t.latestPhoto}</span>
                  </div>
                </div>
                <p className="text-xs font-medium text-zinc-500">Latest ({photoTab})</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-400">
              {t.photoComparisonHint}
            </p>
          </div>

          {/* Achievements */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-zinc-900">{t.achievements}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {achievements.map((a) => (
                <div
                  key={a.id}
                  className={["flex items-center gap-3 rounded-lg border p-4 transition-colors", a.unlocked ? "border-border-brand bg-success-light" : "border-zinc-100 bg-zinc-50 opacity-60"].join(" ")}
                >
                  <span className="text-2xl" role="img" aria-hidden="true">{a.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${a.unlocked ? "text-success" : "text-zinc-500"}`}>{a.title}</p>
                    <p className="text-xs text-zinc-400">{a.description}</p>
                  </div>
                  {a.unlocked && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="ml-auto h-5 w-5 shrink-0 text-success" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
