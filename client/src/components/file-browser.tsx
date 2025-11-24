import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

interface FileItem {
  id: string;
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileItem[];
  modified?: boolean;
}

interface FileBrowserProps {
  files?: FileItem[];
  onFileSelect?: (path: string) => void;
  changedFiles?: string[];
  onFileDoubleClick?: (path: string) => void;
  projectId?: string;
}

// Fetch real files from API
function useProjectFiles(projectId?: string) {
  return useQuery({
    queryKey: ['/api/project-files', projectId],
    queryFn: async () => {
      const url = projectId 
        ? `/api/project-files?projectId=${encodeURIComponent(projectId)}`
        : '/api/project-files';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load files');
      return res.json();
    },
    staleTime: 30000, // 30 seconds
  });
}

function FileTreeItem({ 
  item, 
  onSelect, 
  onDoubleClick,
  changedFiles 
}: { 
  item: FileItem; 
  onSelect?: (path: string) => void;
  onDoubleClick?: (path: string) => void;
  changedFiles?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const isChanged = changedFiles?.includes(item.path);

  if (item.type === "file") {
    return (
      <div
        className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded text-sm cursor-pointer group"
        onClick={() => onSelect?.(item.path)}
        onDoubleClick={() => onDoubleClick?.(item.path)}
        data-testid={`file-item-${item.id}`}
      >
        <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="truncate text-foreground">{item.name}</span>
        {isChanged && (
          <Badge variant="secondary" className="ml-auto h-4 px-1 text-xs">
            M
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div data-testid={`folder-item-${item.id}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded text-sm w-full text-left group"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        {expanded ? (
          <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-primary/70 flex-shrink-0" />
        )}
        <span className="truncate text-foreground font-medium">{item.name}</span>
      </button>

      {expanded && item.children && (
        <div className="ml-3 border-l border-border">
          {item.children.map((child) => (
            <FileTreeItem
              key={child.id}
              item={child}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              changedFiles={changedFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileBrowser({ 
  files: propFiles,
  onFileSelect, 
  onFileDoubleClick,
  changedFiles,
  projectId
}: FileBrowserProps) {
  const { data, isLoading } = useProjectFiles(projectId);
  const files = data?.files || propFiles || [];

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <div className="text-xs font-semibold text-foreground">Files</div>
        {isLoading && <div className="text-xs text-muted-foreground">Loading...</div>}
        <div className="text-xs text-muted-foreground mt-1">Double-click to edit</div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {files.length === 0 ? (
          <div className="text-xs text-muted-foreground p-2">No files found</div>
        ) : (
          files.map((item) => (
            <FileTreeItem
              key={item.id}
              item={item}
              onSelect={onFileSelect}
              onDoubleClick={onFileDoubleClick}
              changedFiles={changedFiles}
            />
          ))
        )}
      </div>
    </div>
  );
}
