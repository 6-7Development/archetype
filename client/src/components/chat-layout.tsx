/**
 * Replit-Style Chat Layout
 * Matches Replit's professional IDE layout structure
 */

import { Menu, X, Settings, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

interface ChatLayoutProps {
  children: React.ReactNode;
  leftSidebar?: React.ReactNode;
  rightSidebar?: React.ReactNode;
  showLeftSidebar?: boolean;
  showRightSidebar?: boolean;
}

export function ChatLayout({
  children,
  leftSidebar,
  rightSidebar,
  showLeftSidebar = true,
  showRightSidebar = true,
}: ChatLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(showLeftSidebar);
  const [rightOpen, setRightOpen] = useState(showRightSidebar);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
      {/* Top Header - Replit Style */}
      <header className="border-b bg-card/50 backdrop-blur-sm px-3 md:px-4 py-2 md:py-3 h-12 md:h-14 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLeftOpen(!leftOpen)}
            className="h-7 w-7 p-0"
            data-testid="button-toggle-left-sidebar"
          >
            <Menu className="w-4 h-4" />
          </Button>
          <div className="text-sm md:text-base font-semibold px-2">Hexad</div>
        </div>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" data-testid="button-publish">
            Publishing
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" data-testid="button-preview">
            Preview
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRightOpen(!rightOpen)}
            className="h-7 w-7 p-0"
            data-testid="button-toggle-right-sidebar"
          >
            {rightOpen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid="button-header-settings">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Area - Resizable Panes */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - File Tree */}
        {leftOpen && leftSidebar && (
          <div className="w-64 border-r bg-card/30 flex flex-col overflow-hidden flex-shrink-0">{leftSidebar}</div>
        )}

        {/* Main Chat Area */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={100} minSize={50} className="flex flex-col overflow-hidden">
            {children}
          </ResizablePanel>

          {/* Right Sidebar - Context/Output/Suggestions */}
          {rightOpen && rightSidebar && (
            <>
              <ResizableHandle className="w-1 bg-border hover:bg-primary/20" />
              <ResizablePanel defaultSize={0} minSize={20} maxSize={40} className="bg-card/30 flex flex-col overflow-hidden">
                {rightSidebar}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
