import { redirect } from "next/navigation";

// The Training "Overview" page has been deprecated. The Training module now
// uses /workouts as its hub. This redirect keeps old bookmarks and the
// sidebar "Resumen" link working.
export default function TrainingPage() {
  redirect("/workouts");
}
