import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocaleCookie } from "@/lib/i18n/actions";
import { getDictionary } from "@/lib/i18n/getDictionary";
import TrainingStartView from "./TrainingStartView";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocaleCookie();
  const dict = await getDictionary(locale);
  return {
    title: dict.nav.training.startWorkout,
  };
}

export default function TrainingStartPage() {
  return (
    <Suspense fallback={null}>
      <TrainingStartView />
    </Suspense>
  );
}
