/**
 * TaskBox - Replit-style task display container
 * Shows task description, expandable sections, real-time updates
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Clock, AlertCircle, CheckCircle2, FileText, Command, Zap } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TaskBoxSection {
  id: string;
  title: string;
  content: string;
  type?: "file" | "command" | "action" | "info";
  icon?: React.ReactNode;
  duration?: number; // ms
}

interface TaskBoxProps {
  taskTitle: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "error";
  sections?: TaskBoxSection[];
  stepNumber?: number;
  totalSteps?: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  onExpand?: () => void;
  className?: string;
  isCompact?: boolean; // Mobile-friendly
}

export function TaskBox({
  taskTitle,
  description,
  status,
  sections = [],
  stepNumber,
  totalSteps,
  startTime,
  endTime,
  error,
  onExpand,
  className,
  isCompact = false,
}: TaskBoxProps) {
  const [isExpanded, setIsExpanded] = useState(!isCompact);
  
  const statusColors = {
    pending: "bg-muted/50 border-muted/30",
    in_progress: "bg-[hsl(50,98%,58%)]/10 border-[hsl(50,98%,58%)]/30",
    completed: "bg-[hsl(145,60%,45%)]/10 border-[hsl(145,60%,45%)]/30",
    error: "bg-destructive/10 border-destructive/30",
  };

  const statusIcons = {
    pending: <Clock className="w-4 h-4 text-muted-foreground" />,
    in_progress: <Zap className="w-4 h-4 text-[hsl(50,98%,58%)] animate-pulse" />,
    completed: <CheckCircle2 className="w-4 h-4 text-[hsl(145,60%,45%)]" />,
    error: <AlertCircle className="w-4 h-4 text-destructive" />,
  };

  const duration = startTime && endTime 
    ? Math.round((endTime.getTime() - startTime.getTime()) / 1000)
    : undefined;

  const sectionIcons: Record<string, React.ReactNode> = {
    file: <FileText className="w-3.5 h-3.5" />,
    command: <Command className="w-3.5 h-3.5" />,
    action: <Zap className="w-3.5 h-3.5" />,
    info: <FileText className="w-3.5 h-3.5" />,
  };

  return (
    <Card className={cn(
      "border",
      statusColors[status],
      className
    )} data-testid={`task-box-${status}`}>
      <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {statusIcons[status]}
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-sm sm:text-base text-foreground break-words">
                    {taskTitle}
                  </h3>
                  {stepNumber && totalSteps && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      Step {stepNumber}/{totalSteps}
                    </Badge>
                  )}
                  {status === "in_progress" && (
                    <Badge className="text-xs flex-shrink-0 bg-[hsl(50,98%,58%)] text-[hsl(50,10%,10%)]">
                      Running
                    </Badge>
                  )}
                  {status === "error" && (
                    <Badge variant="destructive" className="text-xs flex-shrink-0">
                      Failed
                    </Badge>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-none">
                  {description}
                </p>

                {/* Timing */}
                {duration && (
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{duration}s</span>
                  </div>
                )}
              </div>

              {/* Expand Toggle (mobile-friendly) */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 flex-shrink-0"
                onClick={() => setIsExpanded(!isExpanded)}
                data-testid="button-expand-task"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Error Display */}
      {error && (
        <CardContent className="px-4 sm:px-6 py-2 bg-destructive/5 border-t border-destructive/20 text-xs sm:text-sm">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-destructive mb-1">Error</p>
              <p className="text-destructive/80 font-mono text-xs break-words">{error}</p>
            </div>
          </div>
        </CardContent>
      )}

      {/* Expandable Sections */}
      {isExpanded && sections.length > 0 && (
        <CardContent className="pt-0 px-4 sm:px-6 pb-4 border-t border-border/50">
          <div className="space-y-2 mt-4">
            {sections.map((section, idx) => (
              <div
                key={section.id}
                className="rounded-lg bg-background/50 border border-border/30 p-3 text-xs sm:text-sm space-y-1.5"
                data-testid={`task-section-${idx}`}
              >
                <div className="flex items-center gap-2">
                  {section.icon || sectionIcons[section.type || "info"]}
                  <span className="font-medium text-foreground">{section.title}</span>
                  {section.duration && (
                    <span className="text-muted-foreground ml-auto text-xs">
                      {section.duration}ms
                    </span>
                  )}
                </div>
                <pre className="font-mono text-xs bg-muted/30 p-2 rounded border border-border/30 overflow-x-auto max-h-40 overflow-y-auto">
                  {section.content}
                </pre>
              </div>
            ))}
          </div>

          {/* Show More Button */}
          {sections.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-4 h-8 text-xs"
              onClick={onExpand}
              data-testid="button-show-more-sections"
            >
              Show more
            </Button>
          )}
        </CardContent>
      )}

      {/* Mobile-Compact: Collapsed preview */}
      {!isExpanded && sections.length > 0 && isCompact && (
        <CardContent className="px-4 py-2 border-t border-border/30">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <FileText className="w-3 h-3" />
            <span>{sections.length} operations</span>
            <ChevronRight className="w-3 h-3 ml-auto" />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
