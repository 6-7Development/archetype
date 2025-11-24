import { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
}

const DEFAULT_STRUCTURE: FileItem[] = [
  {
    id: "1",
    name: "client",
    type: "folder",
    path: "client",
    children: [
      { id: "1-1", name: "src", type: "folder", path: "client/src", children: [
        { id: "1-1-1", name: "App.tsx", type: "file", path: "client/src/App.tsx" },
        { id: "1-1-2", name: "index.css", type: "file", path: "client/src/index.css" },
      ]},
      { id: "1-2", name: "package.json", type: "file", path: "client/package.json" },
    ],
  },
  {
    id: "2",
    name: "server",
    type: "folder",
    path: "server",
    children: [
      { id: "2-1", name: "index.ts", type: "file", path: "server/index.ts" },
      { id: "2-2", name: "routes", type: "folder", path: "server/routes", children: [
        { id: "2-2-1", name: "chat.ts", type: "file", path: "server/routes/chat.ts" },
      ]},
    ],
  },
  {
    id: "3",
    name: "shared",
    type: "folder",
    path: "shared",
    children: [
      { id: "3-1", name: "schema.ts", type: "file", path: "shared/schema.ts" },
    ],
  },
];

function FileTreeItem({ 
  item, 
  onSelect, 
  changedFiles 
}: { 
  item: FileItem; 
  onSelect?: (path: string) => void;
  changedFiles?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const isChanged = changedFiles?.includes(item.path);

  if (item.type === "file") {
    return (
      <div
        className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded text-sm cursor-pointer group"
        onClick={() => onSelect?.(item.path)}
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
              changedFiles={changedFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileBrowser({ 
  files = DEFAULT_STRUCTURE, 
  onFileSelect, 
  changedFiles 
}: FileBrowserProps) {
  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <div className="text-xs font-semibold text-foreground">Files</div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {files.map((item) => (
          <FileTreeItem
            key={item.id}
            item={item}
            onSelect={onFileSelect}
            changedFiles={changedFiles}
          />
        ))}
      </div>
    </div>
  );
}
