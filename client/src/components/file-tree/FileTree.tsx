import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  Image,
  FilePlus,
  FolderPlus,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  modified?: string;
  language?: string;
}

interface FileTreeProps {
  projectId?: string;
  onFileSelect?: (path: string, content?: string) => void;
  onFileCreate?: (path: string, type: 'file' | 'directory') => void;
  onFileDelete?: (path: string) => void;
  selectedPath?: string;
  changedFiles?: string[];
  className?: string;
}

const FILE_ICONS: Record<string, typeof File> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  json: FileJson,
  md: FileText,
  txt: FileText,
  png: Image,
  jpg: Image,
  jpeg: Image,
  svg: Image,
  gif: Image,
  default: File,
};

function getFileIcon(filename: string): typeof File {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

function TreeNode({
  node,
  depth = 0,
  selectedPath,
  changedFiles = [],
  onFileSelect,
  expandedPaths,
  toggleExpanded,
}: {
  node: FileNode;
  depth?: number;
  selectedPath?: string;
  changedFiles?: string[];
  onFileSelect?: (path: string) => void;
  expandedPaths: Set<string>;
  toggleExpanded: (path: string) => void;
}) {
  const isDirectory = node.type === 'directory';
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const isChanged = changedFiles.includes(node.path);
  const IconComponent = isDirectory 
    ? (isExpanded ? FolderOpen : Folder)
    : getFileIcon(node.name);

  const handleClick = () => {
    if (isDirectory) {
      toggleExpanded(node.path);
    } else {
      onFileSelect?.(node.path);
    }
  };

  return (
    <div data-testid={`tree-node-${node.path.replace(/\//g, '-')}`}>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1 text-sm rounded-sm hover:bg-secondary/50 transition-colors text-left group",
          isSelected && "bg-primary/10 text-primary",
          isChanged && "text-amber-600 dark:text-amber-400"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        data-testid={`button-tree-node-${node.path.replace(/\//g, '-')}`}
      >
        {isDirectory && (
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        )}
        {!isDirectory && <span className="w-4" />}
        
        <IconComponent 
          className={cn(
            "w-4 h-4 flex-shrink-0",
            isDirectory && "text-amber-500",
            isChanged && "text-amber-600"
          )} 
        />
        
        <span className="truncate flex-1">{node.name}</span>
        
        {isChanged && (
          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
        )}
      </button>
      
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children
            .sort((a, b) => {
              if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                changedFiles={changedFiles}
                onFileSelect={onFileSelect}
                expandedPaths={expandedPaths}
                toggleExpanded={toggleExpanded}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  projectId,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  selectedPath,
  changedFiles = [],
  className,
}: FileTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/', '/client', '/server', '/shared']));

  const { data: fileTree, isLoading, refetch } = useQuery<FileNode>({
    queryKey: ['/api/project-files/tree', projectId],
    enabled: !!projectId,
  });

  const toggleExpanded = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!fileTree) return;
    const allPaths = new Set<string>();
    const collectPaths = (node: FileNode) => {
      if (node.type === 'directory') {
        allPaths.add(node.path);
        node.children?.forEach(collectPaths);
      }
    };
    collectPaths(fileTree);
    setExpandedPaths(allPaths);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set(['/']));
  };

  const filteredTree = useMemo(() => {
    if (!fileTree || !searchQuery.trim()) return fileTree;
    
    const query = searchQuery.toLowerCase();
    
    const filterNode = (node: FileNode): FileNode | null => {
      if (node.type === 'file') {
        return node.name.toLowerCase().includes(query) ? node : null;
      }
      
      const filteredChildren = node.children
        ?.map(filterNode)
        .filter((n): n is FileNode => n !== null);
      
      if (filteredChildren && filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      
      return node.name.toLowerCase().includes(query) ? node : null;
    };
    
    return filterNode(fileTree);
  }, [fileTree, searchQuery]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-32", className)} data-testid="file-tree-loading">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="file-tree-container">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-2 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">
          Files
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => onFileCreate?.('/', 'file')}
          title="New File"
          data-testid="button-new-file"
        >
          <FilePlus className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => onFileCreate?.('/', 'directory')}
          title="New Folder"
          data-testid="button-new-folder"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => refetch()}
          title="Refresh"
          data-testid="button-refresh-tree"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="h-7 pl-7 pr-7 text-xs"
            data-testid="input-file-search"
          />
          {searchQuery && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-0 top-0 h-7 w-7"
              onClick={() => setSearchQuery('')}
              data-testid="button-clear-search"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {filteredTree ? (
            <TreeNode
              node={filteredTree}
              selectedPath={selectedPath}
              changedFiles={changedFiles}
              onFileSelect={onFileSelect}
              expandedPaths={expandedPaths}
              toggleExpanded={toggleExpanded}
            />
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="file-tree-empty">
              {searchQuery ? 'No files match your search' : 'No files in project'}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between px-2 py-1 border-t text-xs text-muted-foreground">
        <button
          onClick={expandAll}
          className="hover:text-foreground transition-colors"
          data-testid="button-expand-all"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="hover:text-foreground transition-colors"
          data-testid="button-collapse-all"
        >
          Collapse All
        </button>
      </div>
    </div>
  );
}
