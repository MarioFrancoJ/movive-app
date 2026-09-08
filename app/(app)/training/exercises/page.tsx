import { createClient } from "@/lib/supabase/server";
import ExercisesView, {
  type Exercise,
  type ExerciseCategory,
  type MuscleGroup,
  type Difficulty,
} from "./ExercisesView";

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
