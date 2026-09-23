// lib/training/planner.ts

import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlannerMode = "replace" | "fill_empty";

export interface ApplyTemplateResult {
  ok: boolean;
  workoutId?: string;      // id del workout copia creado
  plannerRowsCreated?: number;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type DayName = (typeof DAYS)[number];

/** Dado un lunes (YYYY-MM-DD) y un día de la semana, devuelve la fecha real. */
function dateForDay(weekStartDate: string, dayName: DayName): string {
  const idx = DAYS.indexOf(dayName);
  const d = new Date(`${weekStartDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + idx);
  return d.toISOString().slice(0, 10);
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Aplica un template al planner del usuario.
 *
 * Hace un snapshot completo: copia el workout (con días y ejercicios) a un
 * workout nuevo del usuario, y crea las filas correspondientes en
 * `training_planner` para la semana indicada.
 *
 * - mode = "replace"   → borra las filas del planner de esa semana antes de insertar.
 * - mode = "fill_empty" → solo inserta en días que aún no tienen workout asignado.
 *
 * NUNCA modifica el template original.
 */
export async function applyTemplateToPlanner(
  templateId: string,
  weekStartDate: string,
  mode: PlannerMode
): Promise<ApplyTemplateResult> {
  const supabase = createClient();

  // 1. Usuario actual
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "NOT_AUTHENTICATED" };

  // 2. Leer template original con días y ejercicios
  const { data: template, error: templateError } = await supabase
    .from("workouts")
    .select(`
      id, name, description, goal, difficulty, duration,
      workout_days (
        id, day_name, sort_order,
        workout_exercises (
          exercise_id, exercise_name, sets, reps, rest_seconds, notes, sort_order
        )
      )
    `)
    .eq("id", templateId)
    .single();

  if (templateError || !template) {
    return { ok: false, error: "TEMPLATE_NOT_FOUND" };
  }

  if (!template.workout_days || template.workout_days.length === 0) {
    return { ok: false, error: "TEMPLATE_EMPTY" };
  }

  // 3. Crear workout copia (snapshot del usuario)
  const { data: copy, error: copyError } = await supabase
    .from("workouts")
    .insert({
      user_id: user.id,
      name: template.name,
      description: template.description,
      goal: template.goal,
      difficulty: template.difficulty,
      duration: template.duration,
      is_template: false,
    })
    .select("id")
    .single();

  if (copyError || !copy) {
    return { ok: false, error: "COPY_FAILED" };
  }

  // 4. Copiar días y ejercicios
  const plannerInserts: Array<{
    user_id: string;
    week_start_date: string;
    day_of_week: DayName;
    workout_id: string;
    source_workout_id: string;
  }> = [];

  for (const day of template.workout_days) {
    const { data: newDay, error: dayError } = await supabase
      .from("workout_days")
      .insert({
        workout_id: copy.id,
        user_id: user.id,
        day_name: day.day_name,
        sort_order: day.sort_order,
      })
      .select("id")
      .single();

    if (dayError || !newDay) continue;

    if (day.workout_exercises && day.workout_exercises.length > 0) {
      const exerciseRows = day.workout_exercises.map((ex) => ({
        workout_day_id: newDay.id,
        user_id: user.id,
        exercise_id: ex.exercise_id,
        exercise_name: ex.exercise_name,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes,
        sort_order: ex.sort_order,
      }));

      await supabase.from("workout_exercises").insert(exerciseRows);
    }

    // Si el día es un día de la semana válido, agregarlo al planner
    if (DAYS.includes(day.day_name as DayName)) {
      plannerInserts.push({
        user_id: user.id,
        week_start_date: weekStartDate,
        day_of_week: day.day_name as DayName,
        workout_id: copy.id,
        source_workout_id: templateId,
      });
    }
  }

  // 5. Aplicar la política del modo
  if (mode === "replace") {
    // Borrar filas previas de esa semana (sin tocar workouts)
    await supabase
      .from("training_planner")
      .delete()
      .eq("user_id", user.id)
      .eq("week_start_date", weekStartDate);
  } else if (mode === "fill_empty") {
    // Leer los días ya ocupados
    const { data: existing } = await supabase
      .from("training_planner")
      .select("day_of_week")
      .eq("user_id", user.id)
      .eq("week_start_date", weekStartDate);

    const occupied = new Set((existing ?? []).map((r) => r.day_of_week));

    // Filtrar inserts a solo días vacíos
    const filtered = plannerInserts.filter((r) => !occupied.has(r.day_of_week));
    plannerInserts.length = 0;
    plannerInserts.push(...filtered);
  }

  // 6. Insertar en el planner
  if (plannerInserts.length > 0) {
    const { error: plannerError } = await supabase
      .from("training_planner")
      .insert(plannerInserts);

    if (plannerError) {
      return { ok: false, error: `PLANNER_INSERT_FAILED: ${plannerError.message}` };
    }
  }

  return {
    ok: true,
    workoutId: copy.id,
    plannerRowsCreated: plannerInserts.length,
  };
}
