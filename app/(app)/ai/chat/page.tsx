import type { Metadata } from "next";
import ChatView from "./ChatView";

export const metadata: Metadata = {
  title: "IA",
};

export default function AiChatPage() {
  return <ChatView />;
}
