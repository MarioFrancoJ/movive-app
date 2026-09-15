import type { Metadata } from "next";
import { getLocaleCookie } from "@/lib/i18n/actions";
import { getDictionary } from "@/lib/i18n/getDictionary";
import RecommendationsView from "./RecommendationsView";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocaleCookie();
  const dict = await getDictionary(locale);
  return {
    title: dict.nav.ai.recommendations,
  };
}

export default function RecommendationsPage() {
  return <RecommendationsView />;
}
