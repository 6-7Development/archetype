/**
 * Chat Layout - Clean, chat-first interface like Replit
 * No tabs, no workspace clutter - just chat + context
 */

import { Menu, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ChatLayoutProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
  sidebarContent?: React.ReactNode;
  showSidebar?: boolean;
}

export function ChatLayout({
  children,
  headerContent,
  sidebarContent,
  showSidebar = true,
}: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(showSidebar);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
      {/* Minimal Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm px-4 py-2 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-6 w-6 p-0"
            data-testid="button-toggle-chat-sidebar"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
          <div className="text-sm font-semibold">LomuAI</div>
        </div>
        <div className="flex items-center gap-2">
          {headerContent}
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" data-testid="button-chat-settings">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Chat Area + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">{children}</div>

        {/* Right Sidebar - Context/Output/Suggestions */}
        {sidebarOpen && sidebarContent && (
          <div className="w-80 border-l bg-card/30 flex flex-col overflow-hidden">{sidebarContent}</div>
        )}
      </div>
    </div>
  );
}
