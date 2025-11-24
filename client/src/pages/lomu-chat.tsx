import { UniversalChat } from "@/components/universal-chat";
import { ChatSidebar } from "@/components/chat-sidebar";
import { Header } from "@/components/header";
import { useState } from "react";

export default function LomuChat() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <Header projectName="LomuAI Chat" onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <UniversalChat targetContext="project" projectId="lomu-standalone" />
        </div>

        {/* Right Sidebar */}
        {sidebarOpen && <ChatSidebar />}
      </div>
    </div>
  );
}
