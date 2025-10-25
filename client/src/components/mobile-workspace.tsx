import { useState } from "react";
import { MessageSquare, Folder, Code2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIChat } from "@/components/ai-chat";
import Editor from "@monaco-editor/react";

interface MobileWorkspaceProps {
  projectId: string;
  files: Array<{ id: string; filename: string; content: string; language: string }>;
  activeFile: { id: string; filename: string; content: string; language: string } | null;
  onFileSelect: (file: any) => void;
  onFileCreate: () => void;
  onFileUpdate: (content: string) => void;
  onFileDelete: (fileId: string) => void;
}

type MobileTab = "chat" | "files" | "editor" | "preview";

export function MobileWorkspace({
  projectId,
  files,
  activeFile,
  onFileSelect,
  onFileCreate,
  onFileUpdate,
  onFileDelete,
}: MobileWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>("chat");

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Tab Content - Full Screen with proper flex constraints */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Chat Tab */}
        {activeTab === "chat" && (
          <div className="h-full min-h-0 flex flex-col overflow-hidden">
            <AIChat currentProjectId={projectId} />
          </div>
        )}

        {/* Files Tab */}
        {activeTab === "files" && (
          <div className="h-full overflow-y-auto p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Files</h2>
                <button
                  onClick={onFileCreate}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
                  data-testid="button-create-file-mobile"
                >
                  New File
                </button>
              </div>
              
              {files.length === 0 ? (
                <div className="text-center py-12">
                  <Folder className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No files yet</p>
                </div>
              ) : (
                files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => {
                      onFileSelect(file);
                      setActiveTab("editor");
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-lg border transition-colors",
                      activeFile?.id === file.id
                        ? "bg-accent border-primary"
                        : "bg-card hover:bg-accent"
                    )}
                    data-testid={`file-mobile-${file.filename}`}
                  >
                    <Code2 className="h-5 w-5 text-primary" />
                    <span className="flex-1 text-left font-medium">{file.filename}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Editor Tab */}
        {activeTab === "editor" && (
          <div className="h-full flex flex-col">
            {activeFile ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
                  <span className="font-medium truncate">{activeFile.filename}</span>
                  <button
                    onClick={() => onFileDelete(activeFile.id)}
                    className="text-destructive text-sm"
                    data-testid="button-delete-file-mobile"
                  >
                    Delete
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Editor
                    height="100%"
                    language={activeFile.language}
                    value={activeFile.content}
                    onChange={(value) => onFileUpdate(value || "")}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Code2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Select a file to edit</p>
                  <button
                    onClick={() => setActiveTab("files")}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
                  >
                    Browse Files
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === "preview" && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
              <span className="font-medium">Preview</span>
            </div>
            <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-900">
              <iframe
                src={`/api/projects/${projectId}/preview`}
                className="w-full h-full border-0"
                title="Project Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation - Touch Optimized */}
      <div className="border-t bg-card">
        <div className="grid grid-cols-4 h-16">
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors",
              activeTab === "chat"
                ? "text-primary bg-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            data-testid="tab-chat"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-xs font-medium">Chat</span>
          </button>

          <button
            onClick={() => setActiveTab("files")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors",
              activeTab === "files"
                ? "text-primary bg-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            data-testid="tab-files"
          >
            <Folder className="h-5 w-5" />
            <span className="text-xs font-medium">Files</span>
          </button>

          <button
            onClick={() => setActiveTab("editor")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors",
              activeTab === "editor"
                ? "text-primary bg-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            data-testid="tab-editor"
          >
            <Code2 className="h-5 w-5" />
            <span className="text-xs font-medium">Code</span>
          </button>

          <button
            onClick={() => setActiveTab("preview")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors",
              activeTab === "preview"
                ? "text-primary bg-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            data-testid="tab-preview"
          >
            <Eye className="h-5 w-5" />
            <span className="text-xs font-medium">Preview</span>
          </button>
        </div>
      </div>
    </div>
  );
}
