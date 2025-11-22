import { AIModelSelector } from "@/components/ai-model-selector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, History, Settings, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  targetContext: 'platform' | 'project' | 'architect';
  creditBalance?: number;
  isFreeAccess?: boolean;
  isConnected?: boolean;
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  className?: string;
}

export function ChatHeader({
  targetContext,
  creditBalance = 0,
  isFreeAccess = false,
  isConnected = true,
  onHistoryClick,
  onSettingsClick,
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
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0" data-testid="header-model-selector">
            <AIModelSelector />
          </div>
          
          {!isConnected && (
            <Badge variant="destructive" className="flex gap-1.5 items-center" data-testid="header-disconnected">
              <WifiOff className="h-3 w-3" />
              <span className="hidden sm:inline">Disconnected</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge 
            variant={isFreeAccess ? "default" : "secondary"}
            className="hidden sm:flex gap-1.5 items-center"
            data-testid="header-credit-badge"
          >
            <Coins className="h-3.5 w-3.5" />
            {isFreeAccess ? "FREE" : `${creditBalance} credits`}
          </Badge>

          <Button
            variant="ghost"
            size="icon"
            onClick={onHistoryClick}
            className="h-8 w-8"
            data-testid="button-history"
          >
            <History className="h-4 w-4" />
            <span className="sr-only">Chat History</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsClick}
            className="h-8 w-8 hidden sm:flex"
            data-testid="button-settings"
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
