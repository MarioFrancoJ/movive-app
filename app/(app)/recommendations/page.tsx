import type { Metadata } from "next";
import RecommendationsView from "./RecommendationsView";

export const metadata: Metadata = {
  title: "Recomendaciones",
};

export default function RecommendationsPage() {
  return <RecommendationsView />;
}
