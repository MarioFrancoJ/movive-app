import type { Metadata } from "next";
import AiCoachView from "./AiCoachView";

export const metadata: Metadata = {
  title: "Entrenador IA",
};

export default function AiCoachPage() {
  return <AiCoachView />;
}
