import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { History, WifiOff, Wrench, FolderCode, ChevronDown, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, type Role } from "@shared/rbac";
import type { User } from "@shared/schema";

interface ChatHeaderProps {
  targetContext: 'platform' | 'project' | 'architect';
  isConnected?: boolean;
  onHistoryClick?: () => void;
  onContextChange?: (context: 'platform' | 'project') => void;
  user?: User | null;
  projectId?: string | null;
  className?: string;
}

export function ChatHeader({
  targetContext,
  isConnected = true,
  onHistoryClick,
  onContextChange,
  user,
  projectId,
  className
}: ChatHeaderProps) {
  const userRole: Role = user?.isOwner ? 'owner' : (user?.role as Role) || 'user';
  const canAccessHealing = hasPermission(userRole, 'healing', 'execute');
  const isHealingMode = targetContext === 'platform';

  return (
    <div 
      className={cn("flex items-center gap-2", className)}
      data-testid="chat-header"
    >
      {/* Context Mode Indicator - RBAC Gated */}
      {canAccessHealing && onContextChange ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 gap-1.5 text-xs font-medium",
                isHealingMode 
                  ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10" 
                  : "text-muted-foreground"
              )}
              data-testid="button-context-switcher"
            >
              {isHealingMode ? (
                <>
                  <Wrench className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Healing</span>
                </>
              ) : (
                <>
                  <FolderCode className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Project</span>
                </>
              )}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem
              onClick={() => onContextChange('project')}
              className={cn(!isHealingMode && "bg-accent")}
              data-testid="menu-item-project-mode"
            >
              <FolderCode className="h-4 w-4 mr-2" />
              <div className="flex flex-col">
                <span>Project Mode</span>
                <span className="text-xs text-muted-foreground">Work on user projects</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onContextChange('platform')}
              className={cn(isHealingMode && "bg-accent")}
              data-testid="menu-item-healing-mode"
            >
              <Wrench className="h-4 w-4 mr-2 text-[hsl(var(--primary))]" />
              <div className="flex flex-col">
                <span className="text-[hsl(var(--primary))]">Healing Mode</span>
                <span className="text-xs text-muted-foreground">Fix platform issues</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Owner access only
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Badge variant="secondary" className="text-xs h-6" data-testid="badge-context-mode">
          <FolderCode className="h-3 w-3 mr-1" />
          {projectId ? 'Project' : 'Chat'}
        </Badge>
      )}

      {/* Connection Status */}
      {!isConnected && (
        <Badge variant="destructive" className="flex gap-1 items-center text-xs" data-testid="header-disconnected">
          <WifiOff className="h-3 w-3" />
          <span className="hidden sm:inline">Offline</span>
        </Badge>
      )}

      {/* History Button */}
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
  );
}
