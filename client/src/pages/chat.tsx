import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useVersion } from "@/providers/version-provider";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/theme-toggle";
import { UniversalChat } from "@/components/universal-chat";
import { LivePreview } from "@/components/live-preview";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Sparkles,
  Home,
  Settings,
  FileCode,
  GripVertical,
  GripHorizontal,
  Maximize2,
  Minimize2,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export default function ChatPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [, setLocation] = useLocation();
  const { isMobile } = useVersion();
  const { user, isLoading: authLoading } = useAuth();

  const [showPreview, setShowPreview] = useState(!isMobile);
  const [previewPosition, setPreviewPosition] = useState<'right' | 'bottom'>('right');
  const [chatHeight, setChatHeight] = useState(65);
  const [chatWidth, setChatWidth] = useState(50);
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
      setPreviewPosition('bottom');
      setChatHeight(70);
    } else {
      setPreviewPosition('right');
      setChatWidth(65);
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
          <h1 className="text-2xl font-bold">Hexad Chat</h1>
          <p className="text-muted-foreground max-w-sm">
            Sign in to start chatting with Hexad and build amazing things together.
          </p>
          <Button asChild className="mt-4">
            <Link href="/auth">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  const toggleLayout = () => {
    if (previewPosition === 'right') {
      setPreviewPosition('bottom');
      setChatHeight(60);
    } else {
      setPreviewPosition('right');
      setChatWidth(55);
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
            <span className="font-semibold text-sm">Hexad</span>
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
              title={previewPosition === 'right' ? 'Stack vertically' : 'Side by side'}
              data-testid="button-toggle-layout"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowPreview(!showPreview)}
            data-testid="button-toggle-preview"
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>

          {showPreview && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsFullscreen(!isFullscreen)}
              data-testid="button-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}

          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        {previewPosition === 'right' && !isMobile ? (
          <div className="h-full flex">
            <div 
              className="flex flex-col overflow-hidden transition-all duration-200"
              style={{ width: showPreview ? `${chatWidth}%` : '100%' }}
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

            {showPreview && (
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
                    "flex-1 min-w-0 bg-muted/30 overflow-hidden",
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
                  <LivePreview projectId={projectId || undefined} />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div 
              className="overflow-hidden transition-all duration-200"
              style={{ height: showPreview ? `${chatHeight}%` : '100%' }}
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

            {showPreview && (
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
                    "flex-1 min-h-0 bg-muted/30 overflow-hidden",
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
                  <LivePreview projectId={projectId || undefined} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
