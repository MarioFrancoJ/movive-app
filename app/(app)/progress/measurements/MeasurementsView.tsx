"use client";

import { useState, useEffect, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Measurement {
  id: string;
  date: string;
  neck: string;
  chest: string;
  waist: string;
  hips: string;
  arm: string;
  thigh: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MeasurementsView() {
  const { dict } = useDictionary();
  const t = dict.progress.measurements;
  const labels = dict.progress.measurementLabels;
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [form, setForm] = useState({
    neck: "",
    chest: "",
    waist: "",
    hips: "",
    arm: "",
    thigh: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Load from Supabase ────────────────────────────────────────────────────

  useEffect(() => {
    async function loadEntries() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from("measurement_entries")
        .select("id, date, neck_cm, chest_cm, waist_cm, hips_cm, left_arm_cm, left_thigh_cm")
        .order("date", { ascending: false });

      if (!fetchError && data) {
        setMeasurements(
          data.map((row) => ({
            id: row.id,
            date: new Date(row.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
            neck: row.neck_cm?.toString() || "",
            chest: row.chest_cm?.toString() || "",
            waist: row.waist_cm?.toString() || "",
            hips: row.hips_cm?.toString() || "",
            arm: row.left_arm_cm?.toString() || "",
            thigh: row.left_thigh_cm?.toString() || "",
          }))
        );
      }

      setLoading(false);
    }

    loadEntries();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
    if (error) setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Require at least one field filled
    const hasValue = Object.values(form).some((v) => v.trim() !== "");
    if (!hasValue) {
      setError(t.errorAtLeastOne);
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

    const today = new Date().toISOString().split("T")[0];

    const { data: inserted, error: insertError } = await supabase
      .from("measurement_entries")
      .insert({
        user_id: user.id,
        date: today,
        neck_cm: form.neck ? parseFloat(form.neck) : null,
        chest_cm: form.chest ? parseFloat(form.chest) : null,
        waist_cm: form.waist ? parseFloat(form.waist) : null,
        hips_cm: form.hips ? parseFloat(form.hips) : null,
        left_arm_cm: form.arm ? parseFloat(form.arm) : null,
        left_thigh_cm: form.thigh ? parseFloat(form.thigh) : null,
      })
      .select("id, date, neck_cm, chest_cm, waist_cm, hips_cm, left_arm_cm, left_thigh_cm")
      .single();

    if (insertError) {
      setError(t.errorSaving.replace("{msg}", String(insertError.message)));
      setSaving(false);
      return;
    }

    if (inserted) {
      const newEntry: Measurement = {
        id: inserted.id,
        date: new Date(inserted.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        neck: inserted.neck_cm?.toString() || "",
        chest: inserted.chest_cm?.toString() || "",
        waist: inserted.waist_cm?.toString() || "",
        hips: inserted.hips_cm?.toString() || "",
        arm: inserted.left_arm_cm?.toString() || "",
        thigh: inserted.left_thigh_cm?.toString() || "",
      };

      setMeasurements((prev) => [newEntry, ...prev]);
    }

    setForm({ neck: "", chest: "", waist: "", hips: "", arm: "", thigh: "" });
    setSaving(false);
  }

  async function handleDelete(entryId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("measurement_entries")
      .delete()
      .eq("id", entryId);

    if (!deleteError) {
      setMeasurements((prev) => prev.filter((m) => m.id !== entryId));
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

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <p className="mb-4 text-sm font-semibold text-zinc-700">
          {t.newMeasurement}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3" role="alert">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input id="neck" type="number" label={t.neckCm} placeholder="e.g. 38" step={0.1} value={form.neck} onChange={handleChange} />
          <Input id="chest" type="number" label={t.chestCm} placeholder="e.g. 100" step={0.1} value={form.chest} onChange={handleChange} />
          <Input id="waist" type="number" label={t.waistCm} placeholder="e.g. 80" step={0.1} value={form.waist} onChange={handleChange} />
          <Input id="hips" type="number" label={t.hipsCm} placeholder="e.g. 95" step={0.1} value={form.hips} onChange={handleChange} />
          <Input id="arm" type="number" label={t.armCm} placeholder="e.g. 35" step={0.1} value={form.arm} onChange={handleChange} />
          <Input id="thigh" type="number" label={t.thighCm} placeholder="e.g. 55" step={0.1} value={form.thigh} onChange={handleChange} />
        </div>
        <div className="mt-5">
          <Button type="submit" disabled={saving}>
            {saving ? dict.common.saving : t.save}
          </Button>
        </div>
      </form>

      {/* History table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <p className="text-sm font-semibold text-zinc-700">
            {t.history.replace("{n}", String(measurements.length))}
          </p>
        </div>

        {measurements.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-zinc-400">{t.noRecords}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50">
                <tr>
                  <th className="px-5 py-3 font-semibold text-zinc-700">{t.colDate}</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">{labels.neck}</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">{labels.chest}</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">{labels.waist}</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">{labels.hips}</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">{t.colArm}</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">{t.colThigh}</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {measurements.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-3 font-medium text-zinc-900">{m.date}</td>
                    <td className="px-5 py-3 text-zinc-600">{m.neck || "—"}</td>
                    <td className="px-5 py-3 text-zinc-600">{m.chest || "—"}</td>
                    <td className="px-5 py-3 text-zinc-600">{m.waist || "—"}</td>
                    <td className="px-5 py-3 text-zinc-600">{m.hips || "—"}</td>
                    <td className="px-5 py-3 text-zinc-600">{m.arm || "—"}</td>
                    <td className="px-5 py-3 text-zinc-600">{m.thigh || "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        className="text-xs font-medium text-zinc-400 transition-colors hover:text-red-600"
                        aria-label={`Delete measurement from ${m.date}`}
                      >
                        {dict.common.delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
