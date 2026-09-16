import type { Metadata } from "next";
import { getLocaleCookie } from "@/lib/i18n/actions";
import { getDictionary } from "@/lib/i18n/getDictionary";
import WorkoutBuilderView from "./WorkoutBuilderView";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocaleCookie();
  const dict = await getDictionary(locale);
  return {
    title: dict.nav.training.workoutBuilder,
  };
}

export default function WorkoutBuilderPage() {
  return <WorkoutBuilderView />;
}
