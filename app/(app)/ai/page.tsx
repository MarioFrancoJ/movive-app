import type { Metadata } from "next";
import AiDashboardView from "./AiDashboardView";

export const metadata: Metadata = {
  title: "IA",
};

export default function AiDashboardPage() {
  return <AiDashboardView />;
}
