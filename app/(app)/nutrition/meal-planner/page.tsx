import type { Metadata } from "next";
import { getLocaleCookie } from "@/lib/i18n/actions";
import { getDictionary } from "@/lib/i18n/getDictionary";
import KpiCard from "@/components/ui/KpiCard";
import MealPlannerView from "./MealPlannerView";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocaleCookie();
  const dict = await getDictionary(locale);
  return {
    title: dict.nav.nutrition.mealPlanner,
  };
}

export default function MealPlannerPage() {
  return <MealPlannerView />;
}
