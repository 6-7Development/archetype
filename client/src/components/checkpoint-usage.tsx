import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Sparkles, ChevronDown, ChevronUp, FileCode } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CheckpointUsageProps {
  command: string;
  checkpoint: {
    complexity: "simple" | "standard" | "complex" | "extended" | "highpower";
    cost: number;
    estimatedTime: string;
    actions: string[];
  };
  timestamp?: Date;
  filesGenerated?: number;
  onViewChanges?: () => void;
  onPreview?: () => void;
}

const complexityColors = {
  simple: "bg-green-500/10 text-green-500 border-green-500/20",
  standard: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  complex: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  extended: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  highpower: "bg-red-500/10 text-red-500 border-red-500/20"
};

const complexityLabels = {
  simple: "Simple",
  standard: "Standard",
  complex: "Complex",
  extended: "Extended Thinking",
  highpower: "High Power"
};

export function CheckpointUsage({ 
  command, 
  checkpoint, 
  timestamp = new Date(), 
  filesGenerated = 0,
  onViewChanges,
  onPreview 
}: CheckpointUsageProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-transparent border-primary/20" data-testid="checkpoint-usage-card">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <CheckCircle className="w-4 h-4 text-green-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground" data-testid="checkpoint-timestamp">
              {getTimeAgo(timestamp)}
            </span>
            <Badge 
              variant="outline" 
              className={cn("text-xs", complexityColors[checkpoint.complexity])}
              data-testid="checkpoint-complexity"
            >
              {complexityLabels[checkpoint.complexity]}
            </Badge>
          </div>
          <p className="text-sm font-medium leading-relaxed" data-testid="checkpoint-command">
            {command}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      {(onViewChanges || onPreview) && (
        <div className="flex gap-2 mb-3">
          {onViewChanges && (
            <Button size="sm" variant="outline" onClick={onViewChanges} data-testid="button-view-changes">
              <FileCode className="w-3 h-3 mr-1" />
              Changes
            </Button>
          )}
          {onPreview && (
            <Button size="sm" variant="outline" onClick={onPreview} data-testid="button-view-preview">
              <Sparkles className="w-3 h-3 mr-1" />
              Preview
            </Button>
          )}
        </div>
      )}

      {/* Usage Metrics */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Time worked
          </span>
          <span className="font-medium" data-testid="checkpoint-time">{checkpoint.estimatedTime}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5" />
            Work done
          </span>
          <span className="font-medium" data-testid="checkpoint-work">
            1 checkpoint{filesGenerated > 0 && ` • ${filesGenerated} files`}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm border-t pt-2">
          <span className="text-muted-foreground flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            Agent Usage
          </span>
          <span className="font-bold text-primary text-base" data-testid="checkpoint-cost">
            ${checkpoint.cost.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Expandable Actions List */}
      {checkpoint.actions && checkpoint.actions.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-toggle-details"
          >
            <span>Actions ({checkpoint.actions.length})</span>
            {showDetails ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {showDetails && (
            <ul className="mt-3 space-y-1.5">
              {checkpoint.actions.map((action, idx) => (
                <li 
                  key={idx} 
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                  data-testid={`checkpoint-action-${idx}`}
                >
                  <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
