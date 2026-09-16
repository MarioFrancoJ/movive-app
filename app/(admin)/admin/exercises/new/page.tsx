import Link from "next/link";
import ExerciseForm from "@/components/admin/ExerciseForm";

export default function NewExercisePage() {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/exercises"
        className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
      >
        ← Back to Exercises
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          New Exercise
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Add a new exercise to the catalogue.
        </p>
      </div>

      <ExerciseForm mode="create" />
    </div>
  );
}
