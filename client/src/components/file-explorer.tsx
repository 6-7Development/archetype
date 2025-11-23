import { File, Folder, ChevronRight, ChevronDown, Plus, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { File as FileType } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface FileExplorerProps {
  files: FileType[];
  activeFileId: string | null;
  onFileSelect: (file: FileType) => void;
  onCreateFile: () => void;
}

export function FileExplorer({ files, activeFileId, onFileSelect, onCreateFile }: FileExplorerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getLanguageBadgeColor = (language: string) => {
    const colors: Record<string, string> = {
      javascript: "bg-yellow-500/10 text-yellow-600
      typescript: "bg-blue-500/10 text-blue-600
      python: "bg-green-500/10 text-green-600
      html: "bg-orange-500/10 text-orange-600
      css: "bg-purple-500/10 text-purple-600
    };
    return colors[language] || "bg-muted text-muted-foreground";
  };

  const getFileStatus = (file: FileType): 'new' | 'modified' | 'unchanged' => {
    if (!file.createdAt) return 'unchanged';
    
    const now = new Date().getTime();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    const createdAt = new Date(file.createdAt).getTime();
    const updatedAt = file.updatedAt ? new Date(file.updatedAt).getTime() : createdAt;
    
    // File is new if created in last 5 minutes
    if (createdAt > fiveMinutesAgo) {
      return 'new';
    }
    
    // File is modified if updated in last 5 minutes and update is after creation
    if (updatedAt > fiveMinutesAgo && updatedAt > createdAt + 1000) {
      return 'modified';
    }
    
    return 'unchanged';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between h-14 px-4 border-b border-card-border bg-card/50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-explorer"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold tracking-tight">Files</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onCreateFile}
          data-testid="button-create-file"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isExpanded && (
        <ScrollArea className="flex-1">
          <div className="p-4">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-muted/50 rounded-xl mb-4">
                  <FileCode className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No files yet</p>
                <p className="text-xs text-muted-foreground">Click + to create your first file</p>
              </div>
            ) : (
              <div className="space-y-1">
                {files.map((file) => {
                  const status = getFileStatus(file);
                  return (
                    <button
                      key={file.id}
                      onClick={() => onFileSelect(file)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-all hover-elevate active-elevate-2 ${
                        activeFileId === file.id
                          ? "bg-primary/10 border border-primary/20"
                          : "border border-transparent"
                      }`}
                      data-testid={`file-item-${file.id}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className={`truncate font-medium ${
                          activeFileId === file.id ? "text-primary" : ""
                        }`}>
                          {file.filename}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {status === 'new' && (
                          <Badge 
                            variant="outline" 
                            className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/20"
                            data-testid={`badge-new-${file.id}`}
                          >
                            NEW
                          </Badge>
                        )}
                        {status === 'modified' && (
                          <Badge 
                            variant="outline" 
                            className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/20"
                            data-testid={`badge-modified-${file.id}`}
                          >
                            MOD
                          </Badge>
                        )}
                        <Badge 
                          variant="outline" 
                          className={`text-xs px-1.5 py-0 h-5 ${getLanguageBadgeColor(file.language)}`}
                        >
                          {file.language.slice(0, 2).toUpperCase()}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
