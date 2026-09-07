"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type ExercisesDict = ReturnType<typeof useDictionary>["dict"]["training"]["exercises"];
type WorkoutsDict = ReturnType<typeof useDictionary>["dict"]["workouts"];

type ExerciseCategory = "Strength" | "Calisthenics" | "Cardio" | "Mobility" | "Flexibility";
type MuscleGroup = "Chest" | "Back" | "Shoulders" | "Biceps" | "Triceps" | "Forearms" | "Core" | "Glutes" | "Quadriceps" | "Hamstrings" | "Calves" | "Full Body";
type Difficulty = "Beginner" | "Intermediate" | "Advanced";

interface Exercise {
  id: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  muscleGroup: MuscleGroup;
  equipment: string;
  difficulty: Difficulty;
}

const EXERCISE_CATEGORIES: ExerciseCategory[] = ["Strength", "Calisthenics", "Cardio", "Mobility", "Flexibility"];
const MUSCLE_GROUPS: MuscleGroup[] = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Core", "Glutes", "Quadriceps", "Hamstrings", "Calves", "Full Body"];
const DIFFICULTIES: Difficulty[] = ["Beginner", "Intermediate", "Advanced"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function difficultyColor(d: Difficulty): string {
  switch (d) {
    case "Beginner":     return "bg-success-light text-success";
    case "Intermediate": return "bg-amber-50 text-amber-700";
    case "Advanced":     return "bg-red-50 text-red-700";
  }
}

function categoryColor(c: ExerciseCategory): string {
  switch (c) {
    case "Strength":    return "bg-blue-50 text-blue-700";
    case "Calisthenics": return "bg-purple-50 text-purple-700";
    case "Cardio":      return "bg-rose-50 text-rose-700";
    case "Mobility":    return "bg-teal-50 text-teal-700";
    case "Flexibility": return "bg-cyan-50 text-cyan-700";
  }
}

// Localized display label for a category value (the value itself stays the logic key).
function categoryLabel(c: ExerciseCategory, t: ExercisesDict): string {
  switch (c) {
    case "Strength":     return t.categoryStrength;
    case "Calisthenics": return t.categoryCalisthenics;
    case "Cardio":       return t.categoryCardio;
    case "Mobility":     return t.categoryMobility;
    case "Flexibility":  return t.categoryFlexibility;
  }
}

// Localized label for a muscle group. The English value stays the logic key
// (matches the DB enum); the dictionary maps it to the display language.
function muscleLabel(m: MuscleGroup, t: ExercisesDict): string {
  return t.muscles[m] ?? m;
}

// Localized label for a difficulty level, reusing the shared workouts.* keys.
function difficultyLabel(d: Difficulty, w: WorkoutsDict): string {
  switch (d) {
    case "Beginner":     return w.difficultyBeginner;
    case "Intermediate": return w.difficultyIntermediate;
    case "Advanced":     return w.difficultyAdvanced;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExercisesPage() {
  const { dict } = useDictionary();
  const t = dict.training.exercises;
  const w = dict.workouts;
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | ExerciseCategory>("All");
  const [muscleFilter, setMuscleFilter] = useState<"All" | MuscleGroup>("All");
  const [difficultyFilter, setDifficultyFilter] = useState<"All" | Difficulty>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadExercises() {
      const supabase = createClient();
      const { data } = await supabase
        .from("exercises")
        .select("id, name, description, category, muscle_group, equipment, difficulty")
        .order("name");

      if (data) {
        setAllExercises(
          data.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description || "",
            category: row.category as ExerciseCategory,
            muscleGroup: row.muscle_group as MuscleGroup,
            equipment: row.equipment,
            difficulty: row.difficulty as Difficulty,
          }))
        );
      }
      setLoading(false);
    }
    loadExercises();
  }, []);

  const filtered = useMemo(() => {
    return allExercises.filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase()) || ex.description.toLowerCase().includes(search.toLowerCase());
      const matchesCat = categoryFilter === "All" || ex.category === categoryFilter;
      const matchesMuscle = muscleFilter === "All" || ex.muscleGroup === muscleFilter;
      const matchesDiff = difficultyFilter === "All" || ex.difficulty === difficultyFilter;
      return matchesSearch && matchesCat && matchesMuscle && matchesDiff;
    });
  }, [allExercises, search, categoryFilter, muscleFilter, difficultyFilter]);

  const featured = useMemo(() => allExercises.slice(0, 6), [allExercises]);
  const showFeatured = !search && categoryFilter === "All" && muscleFilter === "All" && difficultyFilter === "All";

  if (loading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t.available.replace("{n}", String(allExercises.length))}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input type="search" placeholder={t.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search exercises"
            className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
        </div>

        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as "All" | ExerciseCategory)} aria-label="Filter by category"
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200">
          <option value="All">{t.allCategories}</option>
          {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c, t)}</option>)}
        </select>

        <select value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value as "All" | MuscleGroup)} aria-label="Filter by muscle group"
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200">
          <option value="All">{t.allMuscles}</option>
          {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{muscleLabel(m, t)}</option>)}
        </select>

        <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value as "All" | Difficulty)} aria-label="Filter by difficulty"
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200">
          <option value="All">{t.allLevels}</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{difficultyLabel(d, w)}</option>)}
        </select>
      </div>

      {/* Featured */}
      {showFeatured && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">{t.featured}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((ex) => (
              <Link key={ex.id} href={`/training/exercises/${ex.id}`}
                className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900">{ex.name}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColor(ex.difficulty)}`}>{difficultyLabel(ex.difficulty, w)}</span>
                </div>
                <p className="mb-3 text-xs text-zinc-400 line-clamp-2">{ex.description}</p>
                <div className="mt-auto flex items-center gap-2 border-t border-zinc-100 pt-3">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${categoryColor(ex.category)}`}>{categoryLabel(ex.category, t)}</span>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{muscleLabel(ex.muscleGroup, t)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Category sections or filtered grid */}
      {showFeatured ? (
        <div className="flex flex-col gap-8">
          {EXERCISE_CATEGORIES.map((cat) => {
            const catExercises = allExercises.filter((e) => e.category === cat);
            if (catExercises.length === 0) return null;
            return (
              <div key={cat}>
                <h2 className="mb-3 text-sm font-semibold text-zinc-900">{categoryLabel(cat, t)}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {catExercises.map((ex) => (
                    <Link key={ex.id} href={`/training/exercises/${ex.id}`}
                      className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-zinc-900">{ex.name}</h3>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColor(ex.difficulty)}`}>{difficultyLabel(ex.difficulty, w)}</span>
                      </div>
                      <div className="mt-auto flex items-center gap-2">
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{muscleLabel(ex.muscleGroup, t)}</span>
                        <span className="text-xs text-zinc-400">{ex.equipment}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
          <p className="text-sm text-zinc-400">{t.noMatch}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((ex) => (
            <Link key={ex.id} href={`/training/exercises/${ex.id}`}
              className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">{ex.name}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColor(ex.difficulty)}`}>{difficultyLabel(ex.difficulty, w)}</span>
              </div>
              <p className="mb-2 text-xs text-zinc-400 line-clamp-2">{ex.description}</p>
              <div className="mt-auto flex items-center gap-2 border-t border-zinc-100 pt-3">
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${categoryColor(ex.category)}`}>{categoryLabel(ex.category, t)}</span>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{muscleLabel(ex.muscleGroup, t)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
