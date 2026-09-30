"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExercisePickerItem {
  id: string;
  name: string;
  category: string;
  muscle_group: string;
  equipment: string;
  difficulty: string;
}

export interface ExercisePickerLabels {
  title: string;
  searchPlaceholder: string;
  noMatch: string;
  countSummary: string;
  all: string;
  // Create custom
  createCta: string;
  createTitle: string;
  createName: string;
  createNamePlaceholder: string;
  createCategory: string;
  createMuscle: string;
  createEquipment: string;
  createDifficulty: string;
  createDescription: string;
  createDescriptionPlaceholder: string;
  createSave: string;
  createCancel: string;
  createErrorName: string;
  createErrorGeneric: string;
  createBack: string;
}

export interface ExercisePickerProps {
  labels: ExercisePickerLabels;
  onSelect: (exercise: ExercisePickerItem) => void;
  onClose: () => void;
}

// ── Enums (mismos valores que en la DB) ──────────────────────────────────────

const CATEGORIES = ["Strength", "Calisthenics", "Cardio", "Mobility", "Flexibility"] as const;
const MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms",
  "Core", "Glutes", "Quadriceps", "Hamstrings", "Calves", "Full Body",
] as const;
const EQUIPMENT = [
  "None", "Dumbbells", "Barbell", "Resistance Bands",
  "Pull-Up Bar", "Machine", "Kettlebell",
] as const;
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExercisePicker({
  labels,
  onSelect,
  onClose,
}: ExercisePickerProps) {
  const [exercises, setExercises] = useState<ExercisePickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const inputRef = useRef<HTMLInputElement>(null);

  // Create custom exercise mode
  const [mode, setMode] = useState<"list" | "create">("list");

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("exercises")
        .select("id, name, category, muscle_group, equipment, difficulty")
        .order("name");
      if (data) setExercises(data as ExercisePickerItem[]);
      setLoading(false);
    }
    load();
  }, []);

  const categories = useMemo(() => {
    return Array.from(new Set(exercises.map((e) => e.category))).sort();
  }, [exercises]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      const matchesQuery = !q || e.name.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "All" || e.category === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  }, [exercises, query, categoryFilter]);

  // Cuando se crea un ejercicio, lo devolvemos al padre como si lo hubieras seleccionado.
  async function handleCreate(data: {
    name: string;
    category: string;
    muscle_group: string;
    equipment: string;
    difficulty: string;
    description: string | null;
  }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: inserted, error } = await supabase
      .from("exercises")
      .insert({
        name: data.name,
        description: data.description,
        category: data.category as any,
        muscle_group: data.muscle_group as any,
        equipment: data.equipment as any,
        difficulty: data.difficulty as any,
        instructions: [],
        tips: [],
        common_mistakes: [],
        is_system: false,
        created_by: user.id,
      })
      .select("id, name, category, muscle_group, equipment, difficulty")
      .single();

    if (error || !inserted) {
      alert(error?.message ?? "Error");
      return;
    }

    onSelect(inserted as ExercisePickerItem);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "list" ? (
          <>
            {/* Header + search */}
            <div className="border-b border-zinc-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-zinc-900">{labels.title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              </div>
              <div className="relative">
                <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                </svg>
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={labels.searchPlaceholder}
                  className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:h-10"
                />
              </div>
              {categories.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(["All", ...categories] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoryFilter(c)}
                      className={[
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        categoryFilter === c
                          ? "bg-primary text-white"
                          : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      {c === "All" ? labels.all : c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <p className="px-3 py-6 text-center text-sm text-zinc-400">…</p>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-sm text-zinc-400">
                    {labels.noMatch.replace("{query}", query)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMode("create")}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary bg-primary-light px-3 py-2 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary-light/70"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z" />
                    </svg>
                    {labels.createCta}
                  </button>
                </div>
              ) : (
                <>
                  <ul className="flex flex-col">
                    {filtered.map((ex) => (
                      <li key={ex.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(ex)}
                          className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-zinc-50"
                        >
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">
                            💪
                          </div>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-zinc-900">
                              {ex.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-zinc-400">
                              {ex.category} · {ex.muscle_group} · {ex.equipment}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                            {ex.difficulty}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Botón "Crear" siempre visible al final de la lista */}
                  <div className="mt-2 border-t border-zinc-100 pt-2">
                    <button
                      type="button"
                      onClick={() => setMode("create")}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary bg-primary-light px-3 py-2 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary-light/70"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z" />
                      </svg>
                      {labels.createCta}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-zinc-100 px-4 py-2 text-center text-xs text-zinc-400">
              {labels.countSummary
                .replace("{x}", String(filtered.length))
                .replace("{y}", String(exercises.length))}
            </div>
          </>
        ) : (
          <CreateForm
            labels={labels}
            initialName={query}
            onCancel={() => setMode("list")}
            onSubmit={handleCreate}
          />
        )}
      </div>
    </div>
  );
}

// ── Create form (dentro del mismo modal, reemplaza la lista) ─────────────────

function CreateForm({
  labels,
  initialName,
  onCancel,
  onSubmit,
}: {
  labels: ExercisePickerLabels;
  initialName: string;
  onCancel: () => void;
  onSubmit: (data: {
    name: string;
    category: string;
    muscle_group: string;
    equipment: string;
    difficulty: string;
    description: string | null;
  }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [muscleGroup, setMuscleGroup] = useState<string>(MUSCLE_GROUPS[0]);
  const [equipment, setEquipment] = useState<string>(EQUIPMENT[0]);
  const [difficulty, setDifficulty] = useState<string>(DIFFICULTIES[0]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(labels.createErrorName);
      return;
    }
    setSaving(true);
    setError(null);
    await onSubmit({
      name: name.trim(),
      category,
      muscle_group: muscleGroup,
      equipment,
      difficulty,
      description: description.trim() === "" ? null : description.trim(),
    });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 p-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          {labels.createBack}
        </button>
        <h2 className="text-base font-bold text-zinc-900">{labels.createTitle}</h2>
        <span className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">{labels.createName}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={labels.createNamePlaceholder}
              autoFocus
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">{labels.createCategory}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">{labels.createMuscle}</label>
              <select
                value={muscleGroup}
                onChange={(e) => setMuscleGroup(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              >
                {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">{labels.createEquipment}</label>
              <select
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              >
                {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">{labels.createDifficulty}</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              >
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">{labels.createDescription}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={labels.createDescriptionPlaceholder}
              rows={2}
              className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-zinc-100 p-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          {labels.createCancel}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {labels.createSave}
        </button>
      </div>
    </form>
  );
}
