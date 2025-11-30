import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  targetContext: 'platform' | 'project' | 'architect';
  isConnected?: boolean;
  onHistoryClick?: () => void;
  className?: string;
}

export function ChatHeader({
  targetContext,
  isConnected = true,
  onHistoryClick,
  className
}: ChatHeaderProps) {
  return (
    <header 
      className={cn(
        "sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
      data-testid="chat-header"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {!isConnected && (
            <Badge variant="destructive" className="flex gap-1 items-center text-xs" data-testid="header-disconnected">
              <WifiOff className="h-3 w-3" />
              <span className="hidden sm:inline">Disconnected</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onHistoryClick}
            className="h-7 w-7"
            title="Chat History"
            data-testid="button-history"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
