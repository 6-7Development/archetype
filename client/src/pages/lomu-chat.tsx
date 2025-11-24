import { UniversalChat } from "@/components/universal-chat";
import { ChatLayout } from "@/components/chat-layout";
import { ChatSidebar } from "@/components/chat-sidebar";

export default function LomuChat() {
  return (
    <ChatLayout sidebarContent={<ChatSidebar />} showSidebar={true}>
      <UniversalChat targetContext="project" projectId="lomu-standalone" />
    </ChatLayout>
  );
}
