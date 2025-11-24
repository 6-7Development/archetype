/**
 * Left Sidebar - File Tree and Project Context
 * Replit-style narrow sidebar for file navigation
 */

import { ChevronRight, File, Folder, FolderOpen, Plus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState } from 'react';

interface FileTreeItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeItem[];
  expanded?: boolean;
}

const defaultFileTree: FileTreeItem[] = [
  {
    id: '1',
    name: 'client',
    type: 'folder',
    expanded: true,
    children: [
      { id: '1-1', name: 'src', type: 'folder' },
      { id: '1-2', name: 'package.json', type: 'file' },
    ],
  },
  {
    id: '2',
    name: 'server',
    type: 'folder',
    expanded: false,
    children: [
      { id: '2-1', name: 'index.ts', type: 'file' },
      { id: '2-2', name: 'routes.ts', type: 'file' },
    ],
  },
  {
    id: '3',
    name: 'README.md',
    type: 'file',
  },
];

export function LomuSidebar() {
  const [fileTree, setFileTree] = useState(defaultFileTree);

  const toggleFolder = (id: string) => {
    const updateTree = (items: FileTreeItem[]): FileTreeItem[] => {
      return items.map(item => {
        if (item.id === id && item.type === 'folder') {
          return { ...item, expanded: !item.expanded };
        }
        if (item.children) {
          return { ...item, children: updateTree(item.children) };
        }
        return item;
      });
    };
    setFileTree(updateTree(fileTree));
  };

  const renderFileTree = (items: FileTreeItem[], depth = 0) => {
    return items.map(item => (
      <div key={item.id} className="select-none">
        {item.type === 'folder' ? (
          <>
            <div
              className="flex items-center gap-1 px-2 py-1 hover:bg-accent/50 cursor-pointer text-xs h-7 group"
              onClick={() => toggleFolder(item.id)}
              data-testid={`folder-${item.id}`}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${item.expanded ? 'rotate-90' : ''}`} />
              <Folder className="w-4 h-4 text-yellow-600" />
              <span className="flex-1 truncate">{item.name}</span>
              <Button size="sm" variant="ghost" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </div>
            {item.expanded && item.children && (
              <div className="ml-2 border-l border-border/50">
                {renderFileTree(item.children, depth + 1)}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1 hover:bg-accent/50 cursor-pointer text-xs h-7 group" data-testid={`file-${item.id}`}>
            <div className="w-4" />
            <File className="w-4 h-4 text-blue-500" />
            <span className="flex-1 truncate">{item.name}</span>
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b h-12 flex-shrink-0">
        <div className="text-xs font-semibold">PROJECT</div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" data-testid="button-add-file">
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto">{renderFileTree(fileTree)}</div>

      {/* Footer */}
      <div className="border-t p-2 bg-card/30 text-xs text-muted-foreground h-10 flex items-center justify-between flex-shrink-0">
        <span>0 issues</span>
        <Button size="sm" variant="ghost" className="h-5 text-xs" data-testid="button-view-problems">
          View
        </Button>
      </div>
    </div>
  );
}
