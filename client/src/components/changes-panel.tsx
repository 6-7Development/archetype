import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, FileCode, FilePlus, FileEdit, FileX, CheckCircle2 } from "lucide-react";

interface ChangesPanelProps {
  changes: {
    created: string[];
    modified: string[];
    deleted: string[];
    summary: string;
  };
  onClose: () => void;
}

export function ChangesPanel({ changes, onClose }: ChangesPanelProps) {
  const totalCount = changes.created.length + changes.modified.length + changes.deleted.length;

  // Don't render if no changes
  if (totalCount === 0) return null;

  return (
    <Card className="border-primary/50 bg-card shadow-lg" data-testid="card-changes-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Generation Complete</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-changes"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Files Changed Summary */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileCode className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">
              Files Changed ({totalCount})
            </h4>
          </div>
          
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1.5">
              {/* Created Files */}
              {changes.created.map((filename) => (
                <div
                  key={`created-${filename}`}
                  className="flex items-start gap-2 text-sm p-2 rounded-md hover-elevate"
                  data-testid={`change-created-${filename}`}
                >
                  <FilePlus className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600 />
                  <span className="flex-1 font-mono text-xs break-all">{filename}</span>
                  <Badge
                    variant="outline"
                    className="flex-shrink-0 text-xs border-green-500/30 text-green-600
                  >
                    NEW
                  </Badge>
                </div>
              ))}

              {/* Modified Files */}
              {changes.modified.map((filename) => (
                <div
                  key={`modified-${filename}`}
                  className="flex items-start gap-2 text-sm p-2 rounded-md hover-elevate"
                  data-testid={`change-modified-${filename}`}
                >
                  <FileEdit className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-600 />
                  <span className="flex-1 font-mono text-xs break-all">{filename}</span>
                  <Badge
                    variant="outline"
                    className="flex-shrink-0 text-xs border-yellow-500/30 text-yellow-600
                  >
                    MODIFIED
                  </Badge>
                </div>
              ))}

              {/* Deleted Files */}
              {changes.deleted.map((filename) => (
                <div
                  key={`deleted-${filename}`}
                  className="flex items-start gap-2 text-sm p-2 rounded-md hover-elevate"
                  data-testid={`change-deleted-${filename}`}
                >
                  <FileX className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600 />
                  <span className="flex-1 font-mono text-xs break-all line-through opacity-70">
                    {filename}
                  </span>
                  <Badge
                    variant="outline"
                    className="flex-shrink-0 text-xs border-red-500/30 text-red-600
                  >
                    DELETED
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Summary of Changes */}
        {changes.summary && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span>💡</span>
              <span>What Changed:</span>
            </h4>
            <div className="text-sm text-muted-foreground space-y-1">
              {changes.summary.split('\n').filter(line => line.trim()).map((line, idx) => (
                <div key={idx} className="pl-2">
                  {line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')
                    ? line.trim()
                    : `• ${line.trim()}`}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
