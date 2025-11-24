import { UniversalChat } from "@/components/universal-chat";
import { ChatLayout } from "@/components/chat-layout";
import { ChatSidebar } from "@/components/chat-sidebar";
import { LomuSidebar } from "@/components/lomu-sidebar";

export default function LomuChat() {
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
