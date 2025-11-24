import { useEffect } from "react";
import { UniversalChat } from "@/components/universal-chat";
import { ChatLayout } from "@/components/chat-layout";
import { ChatSidebar } from "@/components/chat-sidebar";
import { LomuSidebar } from "@/components/lomu-sidebar";

export default function LomuChat() {
  // Clear chat history on page load to avoid showing stale messages
  useEffect(() => {
    const MESSAGES_STORAGE_KEY = `lomu-chat-messages:project:lomu-standalone`;
    localStorage.removeItem(MESSAGES_STORAGE_KEY);
  }, []);

  return (
    <ChatLayout 
      leftSidebar={<LomuSidebar />}
      rightSidebar={<ChatSidebar />}
      showLeftSidebar={true}
      showRightSidebar={true}
    >
      <UniversalChat targetContext="project" projectId="lomu-standalone" />
    </ChatLayout>
  );
}
