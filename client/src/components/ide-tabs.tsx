import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, Eye, Terminal as TerminalIcon, FileText, Database, AlertCircle, GitBranch, Search, Settings, FileJson, CheckSquare, Package } from "lucide-react";
import { MonacoEditor } from "@/components/monaco-editor";
import { LivePreview } from "@/components/live-preview";
import { Terminal } from "@/components/terminal";
import { DatabaseViewer } from "@/components/database-viewer";
import { GitPanel } from "@/components/git-panel";
import { ProblemsPanel } from "@/components/problems-panel";
import { SearchPanel } from "@/components/search-panel";
import { EnvBrowser } from "@/components/env-browser";
import { LogsViewer } from "@/components/logs-viewer";
import { PackageManager } from "@/components/package-manager";

interface IDETabsProps {
  projectId: string;
  selectedFile?: { path: string; content: string; language: string };
  onFileSelect?: (path: string) => void;
  onFileChange?: (path: string, content: string) => void;
}

export function IDETabs({ projectId, selectedFile, onFileSelect, onFileChange }: IDETabsProps) {
  const [editContent, setEditContent] = useState(selectedFile?.content || "");

  const handleEditorChange = (value: string | undefined) => {
    if (!value || !selectedFile) return;
    setEditContent(value);
    onFileChange?.(selectedFile.path, value);
  };

  return (
    <Tabs defaultValue="editor" className="w-full h-full flex flex-col bg-card">
      {/* Tab Bar */}
      <TabsList className="w-full justify-start rounded-none border-b bg-muted/50 h-10 px-2 gap-1">
        <TabsTrigger value="editor" className="gap-1 text-xs" data-testid="tab-editor">
          <Code2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Editor</span>
        </TabsTrigger>

        <TabsTrigger value="preview" className="gap-1 text-xs" data-testid="tab-preview">
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Preview</span>
        </TabsTrigger>

        <TabsTrigger value="terminal" className="gap-1 text-xs" data-testid="tab-terminal">
          <TerminalIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Terminal</span>
        </TabsTrigger>

        <TabsTrigger value="files" className="gap-1 text-xs" data-testid="tab-files">
          <FileText className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Files</span>
        </TabsTrigger>

        <TabsTrigger value="database" className="gap-1 text-xs" data-testid="tab-database">
          <Database className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">DB</span>
        </TabsTrigger>

        <TabsTrigger value="problems" className="gap-1 text-xs" data-testid="tab-problems">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Problems</span>
        </TabsTrigger>

        <TabsTrigger value="git" className="gap-1 text-xs" data-testid="tab-git">
          <GitBranch className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Git</span>
        </TabsTrigger>

        <TabsTrigger value="search" className="gap-1 text-xs" data-testid="tab-search">
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search</span>
        </TabsTrigger>

        <TabsTrigger value="env" className="gap-1 text-xs" data-testid="tab-env">
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Env</span>
        </TabsTrigger>

        <TabsTrigger value="logs" className="gap-1 text-xs" data-testid="tab-logs">
          <FileJson className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logs</span>
        </TabsTrigger>

        <TabsTrigger value="tests" className="gap-1 text-xs" data-testid="tab-tests">
          <CheckSquare className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tests</span>
        </TabsTrigger>

        <TabsTrigger value="packages" className="gap-1 text-xs" data-testid="tab-packages">
          <Package className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Packages</span>
        </TabsTrigger>
      </TabsList>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* Editor Tab */}
        <TabsContent value="editor" className="h-full m-0" data-testid="content-editor">
          {selectedFile ? (
            <div className="h-full flex flex-col">
              <div className="px-3 py-2 border-b bg-muted/30 text-xs text-muted-foreground">
                {selectedFile.path}
              </div>
              <div className="flex-1 overflow-hidden">
                <MonacoEditor
                  value={editContent}
                  onChange={(value) => handleEditorChange(value)}
                  language={selectedFile.language}
                  readOnly={false}
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Select a file to edit
            </div>
          )}
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="h-full m-0 flex flex-col" data-testid="content-preview">
          <iframe
            key={`preview-${projectId}`}
            src="http://localhost:5000"
            className="flex-1 border-0 w-full"
            title="Live Preview"
            data-testid="iframe-preview"
            onLoad={() => console.log("[PREVIEW] Iframe loaded")}
            onError={() => console.error("[PREVIEW] Iframe failed to load")}
          />
        </TabsContent>

        {/* Terminal Tab */}
        <TabsContent value="terminal" className="h-full m-0" data-testid="content-terminal">
          <Terminal projectId={projectId} />
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="h-full m-0 overflow-auto" data-testid="content-files">
          <div className="p-4 text-xs text-muted-foreground">
            Files are shown in the sidebar. Click a file to edit it in the Editor tab.
          </div>
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database" className="h-full m-0" data-testid="content-database">
          <DatabaseViewer />
        </TabsContent>

        {/* Problems Tab */}
        <TabsContent value="problems" className="h-full m-0" data-testid="content-problems">
          <ProblemsPanel />
        </TabsContent>

        {/* Git Tab */}
        <TabsContent value="git" className="h-full m-0" data-testid="content-git">
          <GitPanel projectId={projectId} />
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="h-full m-0" data-testid="content-search">
          <SearchPanel projectId={projectId} />
        </TabsContent>

        {/* Env Tab */}
        <TabsContent value="env" className="h-full m-0" data-testid="content-env">
          <EnvBrowser />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="h-full m-0" data-testid="content-logs">
          <LogsViewer />
        </TabsContent>

        {/* Tests Tab */}
        <TabsContent value="tests" className="h-full m-0" data-testid="content-tests">
          <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Tests</h3>
            </div>
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-sm mb-2">Run tests with npm</p>
                <code className="text-xs bg-muted p-2 rounded block">npm run test</code>
                <p className="text-xs text-muted-foreground mt-3">Test results will appear in the Terminal</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages" className="h-full m-0" data-testid="content-packages">
          <PackageManager />
        </TabsContent>
      </div>
    </Tabs>
  );
}
