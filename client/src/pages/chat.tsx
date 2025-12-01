import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useVersion } from "@/providers/version-provider";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/theme-toggle";
import { UniversalChat } from "@/components/universal-chat";
import { IDETabsPanel } from "@/components/ide-tabs-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Eye,
  EyeOff,
  Sparkles,
  Home,
  GripVertical,
  GripHorizontal,
  Maximize2,
  Minimize2,
  LayoutGrid,
  PanelRightClose,
  PanelRightOpen,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export default function ChatPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [, setLocation] = useLocation();
  const { isMobile } = useVersion();
  const { user, isLoading: authLoading } = useAuth();
  
  // RBAC: Context switching between project and platform modes
  const [context, setContext] = useState<'project' | 'platform'>('project');
  const canAccessPlatformHealing = user?.role === 'owner' || user?.role === 'admin';

  const [showPanel, setShowPanel] = useState(!isMobile);
  const [panelPosition, setPanelPosition] = useState<'right' | 'bottom'>('right');
  const [chatHeight, setChatHeight] = useState(60);
  const [chatWidth, setChatWidth] = useState(45);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState<'vertical' | 'horizontal' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
  });

  useEffect(() => {
    if (isMobile) {
      setPanelPosition('bottom');
      setChatHeight(65);
    } else {
      setPanelPosition('right');
      setChatWidth(45);
    }
  }, [isMobile]);

  const handleResizeStart = useCallback((type: 'vertical' | 'horizontal') => {
    setIsResizing(true);
    setResizeType(type);
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeType(null);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    
    if (resizeType === 'vertical') {
      const newHeight = ((e.clientY - rect.top) / rect.height) * 100;
      setChatHeight(Math.max(30, Math.min(85, newHeight)));
    } else if (resizeType === 'horizontal') {
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      setChatWidth(Math.max(30, Math.min(80, newWidth)));
    }
  }, [isResizing, resizeType]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isResizing || !containerRef.current || e.touches.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    
    if (resizeType === 'vertical') {
      const newHeight = ((touch.clientY - rect.top) / rect.height) * 100;
      setChatHeight(Math.max(30, Math.min(85, newHeight)));
    } else if (resizeType === 'horizontal') {
      const newWidth = ((touch.clientX - rect.left) / rect.width) * 100;
      setChatWidth(Math.max(30, Math.min(80, newWidth)));
    }
  }, [isResizing, resizeType]);

  useEffect(() => {
    const handleMouseUp = () => handleResizeEnd();
    const handleTouchEnd = () => handleResizeEnd();

    if (isResizing) {
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchend', handleTouchEnd);
      document.body.style.cursor = resizeType === 'vertical' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, resizeType, handleResizeEnd]);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Skeleton className="w-32 h-8" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Sparkles className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">BeeHive Chat</h1>
          <p className="text-muted-foreground max-w-sm">
            Sign in to start chatting with BeeHive and build amazing things together.
          </p>
          <Button asChild className="mt-4">
            <Link href="/auth">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  const toggleLayout = () => {
    if (panelPosition === 'right') {
      setPanelPosition('bottom');
      setChatHeight(55);
    } else {
      setPanelPosition('right');
      setChatWidth(45);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="h-screen flex flex-col bg-background overflow-hidden"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      data-testid="chat-page"
    >
      <header className="h-12 min-h-[48px] border-b flex items-center justify-between px-3 bg-card shrink-0" data-testid="header-chat">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild data-testid="button-home">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
            </Link>
          </Button>
          
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">BeeHive</span>
            {projectId && project && (
              <Badge variant="secondary" className="text-xs">
                {(project as any).name || 'Project'}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleLayout}
              title={panelPosition === 'right' ? 'Stack vertically' : 'Side by side'}
              data-testid="button-toggle-layout"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowPanel(!showPanel)}
            data-testid="button-toggle-panel"
            title={showPanel ? 'Hide tools panel' : 'Show tools panel'}
          >
            {showPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>

          {showPanel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsFullscreen(!isFullscreen)}
              data-testid="button-fullscreen"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}

          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        {panelPosition === 'right' && !isMobile ? (
          <div className="h-full flex">
            <div 
              className="flex flex-col overflow-hidden transition-all duration-200"
              style={{ width: showPanel ? `${chatWidth}%` : '100%' }}
            >
              <UniversalChat 
                targetContext={projectId ? 'project' : 'platform'}
                projectId={projectId || null}
                onProjectGenerated={(result) => {
                  if (result?.projectId) {
                    queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                  }
                }}
              />
            </div>

            {showPanel && (
              <>
                <div
                  className={cn(
                    "w-2 flex items-center justify-center cursor-col-resize group shrink-0",
                    "hover:bg-primary/10 transition-colors",
                    isResizing && resizeType === 'horizontal' && "bg-primary/20"
                  )}
                  onMouseDown={() => handleResizeStart('horizontal')}
                  onTouchStart={() => handleResizeStart('horizontal')}
                  data-testid="resize-handle-horizontal"
                >
                  <GripVertical className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                <div 
                  className={cn(
                    "flex-1 min-w-0 overflow-hidden",
                    isFullscreen && "fixed inset-0 z-50 bg-background"
                  )}
                >
                  {isFullscreen && (
                    <div className="absolute top-2 right-2 z-10">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setIsFullscreen(false)}
                        data-testid="button-exit-fullscreen"
                      >
                        <Minimize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <IDETabsPanel 
                    projectId={projectId || null}
                    activeContext={projectId ? 'project' : 'platform'}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div 
              className="overflow-hidden transition-all duration-200"
              style={{ height: showPanel ? `${chatHeight}%` : '100%' }}
            >
              <UniversalChat 
                targetContext={projectId ? 'project' : 'platform'}
                projectId={projectId || null}
                onProjectGenerated={(result) => {
                  if (result?.projectId) {
                    queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                  }
                }}
              />
            </div>

            {showPanel && (
              <>
                <div
                  className={cn(
                    "h-3 flex items-center justify-center cursor-row-resize group shrink-0",
                    "hover:bg-primary/10 transition-colors touch-none",
                    isResizing && resizeType === 'vertical' && "bg-primary/20"
                  )}
                  onMouseDown={() => handleResizeStart('vertical')}
                  onTouchStart={() => handleResizeStart('vertical')}
                  data-testid="resize-handle-vertical"
                >
                  <GripHorizontal className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                <div 
                  className={cn(
                    "flex-1 min-h-0 overflow-hidden",
                    isFullscreen && "fixed inset-0 z-50 bg-background"
                  )}
                >
                  {isFullscreen && (
                    <div className="absolute top-2 right-2 z-10">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setIsFullscreen(false)}
                        data-testid="button-exit-fullscreen-mobile"
                      >
                        <Minimize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <IDETabsPanel 
                    projectId={projectId || null}
                    activeContext={projectId ? 'project' : 'platform'}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
