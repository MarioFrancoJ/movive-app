"use client";

import { useState, useEffect, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeightEntry {
  id: string;
  date: string;
  weight: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeightView() {
  const { dict } = useDictionary();
  const t = dict.progress.weight;
  const [logs, setLogs] = useState<WeightEntry[]>([]);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Load from Supabase ────────────────────────────────────────────────────

  useEffect(() => {
    async function loadEntries() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from("weight_entries")
        .select("id, date, weight_kg")
        .order("date", { ascending: false });

      if (!fetchError && data) {
        setLogs(
          data.map((row) => ({
            id: row.id,
            date: new Date(row.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
            weight: Number(row.weight_kg),
          }))
        );
      }

      setLoading(false);
    }

    loadEntries();
  }, []);

  // ── Computed metrics ──────────────────────────────────────────────────────

  const currentWeight = logs.length > 0 ? logs[0].weight : null;
  const startingWeight = logs.length > 0 ? logs[logs.length - 1].weight : null;
  const difference =
    currentWeight !== null && startingWeight !== null
      ? currentWeight - startingWeight
      : null;

  // ── Save (Upsert) ────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsed = parseFloat(weight);
    if (!weight.trim() || isNaN(parsed) || parsed < 20 || parsed > 500) {
      setError(t.errorInvalid);
      return;
    }

    setError("");
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError(dict.common.errorNotAuthenticated);
      setSaving(false);
      return;
    }

    const { data: upserted, error: upsertError } = await supabase
      .from("weight_entries")
      .upsert(
        {
          user_id: user.id,
          date,
          weight_kg: parsed,
        },
        { onConflict: "user_id,date" }
      )
      .select("id, date, weight_kg")
      .single();

    if (upsertError) {
      setError(t.errorSaving.replace("{msg}", String(upsertError.message)));
      setSaving(false);
      return;
    }

    // Update local state
    if (upserted) {
      const formattedEntry: WeightEntry = {
        id: upserted.id,
        date: new Date(upserted.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        weight: Number(upserted.weight_kg),
      };

      // Replace existing entry for same date or add new
      setLogs((prev) => {
        const filtered = prev.filter((e) => e.id !== upserted.id);
        const updated = [formattedEntry, ...filtered];
        // Re-sort by date descending
        return updated.sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      });
    }

    setWeight("");
    setSaving(false);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(entryId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("weight_entries")
      .delete()
      .eq("id", entryId);

    if (!deleteError) {
      setLogs((prev) => prev.filter((e) => e.id !== entryId));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {t.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t.subtitle}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-zinc-400">{t.currentWeight}</p>
          <p className="text-2xl font-bold text-zinc-900">
            {currentWeight !== null ? `${currentWeight} kg` : "—"}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-zinc-400">{t.startingWeight}</p>
          <p className="text-2xl font-bold text-zinc-900">
            {startingWeight !== null ? `${startingWeight} kg` : "—"}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-zinc-400">{t.difference}</p>
          <p
            className={`text-2xl font-bold ${
              difference !== null && difference < 0
                ? "text-success"
                : difference !== null && difference > 0
                ? "text-red-600"
                : "text-zinc-900"
            }`}
          >
            {difference !== null
              ? `${difference > 0 ? "+" : ""}${difference.toFixed(1)} kg`
              : "—"}
          </p>
        </div>
      </div>

      {/* Log form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <p className="mb-4 text-sm font-semibold text-zinc-700">{t.logWeight}</p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <Input
              id="weight"
              type="number"
              label={t.weightKg}
              placeholder={t.weightPlaceholder}
              step={0.1}
              min={20}
              max={500}
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value);
                if (error) setError("");
              }}
              error={error}
            />
          </div>
          <div className="w-40">
            <Input
              id="date"
              type="date"
              label={dict.common.date}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? dict.common.saving : dict.common.save}
          </Button>
        </div>
      </form>

      {/* History table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <p className="text-sm font-semibold text-zinc-700">
            {t.history.replace("{n}", String(logs.length))}
          </p>
        </div>

        {logs.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-zinc-400">{t.noEntries}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50">
                <tr>
                  <th className="px-5 py-3 font-semibold text-zinc-700">{t.colDate}</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">{t.colWeight}</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">{t.colChange}</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((entry, i) => {
                  const prev = logs[i + 1];
                  const change = prev
                    ? entry.weight - prev.weight
                    : null;
                  return (
                    <tr key={entry.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-3 font-medium text-zinc-900">
                        {entry.date}
                      </td>
                      <td className="px-5 py-3 text-zinc-600">
                        {entry.weight} kg
                      </td>
                      <td className="px-5 py-3">
                        {change !== null ? (
                          <span
                            className={`text-xs font-medium ${
                              change < 0
                                ? "text-success"
                                : change > 0
                                ? "text-red-600"
                                : "text-zinc-400"
                            }`}
                          >
                            {change > 0 ? "+" : ""}
                            {change.toFixed(1)} kg
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="text-xs font-medium text-zinc-400 transition-colors hover:text-red-600"
                          aria-label={`Delete entry for ${entry.date}`}
                        >
                          {dict.common.delete}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
