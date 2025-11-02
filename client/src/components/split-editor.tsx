import { useState, useEffect } from "react";
import { MonacoEditor } from "@/components/monaco-editor";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { FileCode, X, Columns2 } from "lucide-react";
import type { File } from "@shared/schema";
import { cn } from "@/lib/utils";

interface SplitEditorProps {
  files: File[];
  leftFileId: string | null;
  rightFileId: string | null;
  splitEnabled: boolean;
  onLeftFileChange: (fileId: string | null) => void;
  onRightFileChange: (fileId: string | null) => void;
  onLeftContentChange: (content: string) => void;
  onRightContentChange: (content: string) => void;
  onSplitToggle: () => void;
  leftContent: string;
  rightContent: string;
  compact?: boolean;
}

export function SplitEditor({
  files,
  leftFileId,
  rightFileId,
  splitEnabled,
  onLeftFileChange,
  onRightFileChange,
  onLeftContentChange,
  onRightContentChange,
  onSplitToggle,
  leftContent,
  rightContent,
  compact = false,
}: SplitEditorProps) {
  const leftFile = files.find(f => f.id === leftFileId);
  const rightFile = files.find(f => f.id === rightFileId);

  // Single editor view
  if (!splitEnabled) {
    return (
      <div className="h-full flex flex-col">
        {/* Single editor toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-card">
          <Select value={leftFileId || ""} onValueChange={onLeftFileChange}>
            <SelectTrigger className="h-8 w-[200px]" data-testid="select-editor-file">
              <SelectValue placeholder="Select file..." />
            </SelectTrigger>
            <SelectContent>
              {files.map(file => (
                <SelectItem key={file.id} value={file.id} data-testid={`file-option-${file.filename}`}>
                  <div className="flex items-center gap-2">
                    <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{file.filename}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex-1" />
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2"
            onClick={onSplitToggle}
            data-testid="button-toggle-split"
          >
            <Columns2 className="h-4 w-4" />
            <span className="text-xs">Split View</span>
          </Button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          {leftFile ? (
            <MonacoEditor
              value={leftContent}
              onChange={(value) => onLeftContentChange(value || "")}
              language={leftFile.language}
              compact={compact}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileCode className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Select a file to start editing</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Split view
  return (
    <div className="h-full flex flex-col">
      {/* Split view toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2"
          onClick={onSplitToggle}
          data-testid="button-toggle-split"
        >
          <Columns2 className="h-4 w-4 text-primary" />
          <span className="text-xs">Exit Split</span>
        </Button>
      </div>

      {/* Resizable split panels */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left pane */}
          <ResizablePanel defaultSize={50} minSize={20}>
            <div className="h-full flex flex-col">
              {/* Left pane header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                <Select value={leftFileId || ""} onValueChange={onLeftFileChange}>
                  <SelectTrigger className="h-8 w-[180px]" data-testid="select-left-file">
                    <SelectValue placeholder="Select file..." />
                  </SelectTrigger>
                  <SelectContent>
                    {files.map(file => (
                      <SelectItem key={file.id} value={file.id} data-testid={`left-file-${file.filename}`}>
                        <div className="flex items-center gap-2">
                          <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{file.filename}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {leftFileId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onLeftFileChange(null)}
                    data-testid="button-close-left"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Left editor */}
              <div className="flex-1 overflow-hidden">
                {leftFile ? (
                  <MonacoEditor
                    value={leftContent}
                    onChange={(value) => onLeftContentChange(value || "")}
                    language={leftFile.language}
                    compact={compact}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-muted/10">
                    <div className="text-center">
                      <FileCode className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Select a file for left pane</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          {/* Resizable handle */}
          <ResizableHandle withHandle className="w-1.5 bg-border hover:bg-primary/20 transition-colors" />

          {/* Right pane */}
          <ResizablePanel defaultSize={50} minSize={20}>
            <div className="h-full flex flex-col">
              {/* Right pane header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                <Select value={rightFileId || ""} onValueChange={onRightFileChange}>
                  <SelectTrigger className="h-8 w-[180px]" data-testid="select-right-file">
                    <SelectValue placeholder="Select file..." />
                  </SelectTrigger>
                  <SelectContent>
                    {files.map(file => (
                      <SelectItem key={file.id} value={file.id} data-testid={`right-file-${file.filename}`}>
                        <div className="flex items-center gap-2">
                          <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{file.filename}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {rightFileId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRightFileChange(null)}
                    data-testid="button-close-right"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Right editor */}
              <div className="flex-1 overflow-hidden">
                {rightFile ? (
                  <MonacoEditor
                    value={rightContent}
                    onChange={(value) => onRightContentChange(value || "")}
                    language={rightFile.language}
                    compact={compact}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-muted/10">
                    <div className="text-center">
                      <FileCode className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Select a file for right pane</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
