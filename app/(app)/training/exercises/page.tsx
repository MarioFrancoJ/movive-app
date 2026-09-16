import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { getLocaleCookie } from "@/lib/i18n/actions";
import { getDictionary } from "@/lib/i18n/getDictionary";
import ExercisesView, {
  type Exercise,
  type ExerciseCategory,
  type MuscleGroup,
  type Difficulty,
} from "./ExercisesView";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocaleCookie();
  const dict = await getDictionary(locale);
  return {
    title: dict.nav.training.exercises,
  };
}

// Server Component: fetch the exercise catalog on the server (no client
// waterfall / spinner) and hand it to the interactive client view.
export default async function ExercisesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("exercises")
    .select("id, name, description, category, muscle_group, equipment, difficulty")
    .order("name");

  const exercises: Exercise[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || "",
    category: row.category as ExerciseCategory,
    muscleGroup: row.muscle_group as MuscleGroup,
    equipment: row.equipment,
    difficulty: row.difficulty as Difficulty,
  }));

  return <ExercisesView initialExercises={exercises} />;
}
