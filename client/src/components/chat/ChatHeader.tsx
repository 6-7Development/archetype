import { AIModelSelector } from "@/components/ai-model-selector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, History, Settings, Wifi, WifiOff, BarChart3 } from "lucide-react";
import { TokenMeter } from "@/components/token-meter";
import { RateLimitIndicator } from "@/components/rate-limit-indicator";
import { cn } from "@/lib/utils";
import { useLink } from "wouter";

interface ChatHeaderProps {
  targetContext: 'platform' | 'project' | 'architect';
  creditBalance?: number;
  isFreeAccess?: boolean;
  isConnected?: boolean;
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  className?: string;
  sessionTokens?: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number };
  monthlyTokens?: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number };
}

export function ChatHeader({
  targetContext,
  creditBalance = 0,
  isFreeAccess = false,
  isConnected = true,
  onHistoryClick,
  onSettingsClick,
  className,
  sessionTokens,
  monthlyTokens
}: ChatHeaderProps) {
  const [, navigate] = useLink();
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
          {/* Token Meter */}
          {sessionTokens && <TokenMeter sessionTokens={sessionTokens} monthlyTokens={monthlyTokens} />}

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
            onClick={() => navigate('/consultation-history')}
            className="h-8 w-8"
            title="Architect Consultations"
            data-testid="button-consultations"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="sr-only">Architect Consultations</span>
          </Button>

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
