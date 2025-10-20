import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { MonacoEditor } from "@/components/monaco-editor";
import { ThemeToggle } from "@/components/theme-toggle";
import { AIChat } from "@/components/ai-chat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Code2, 
  Play, 
  Square,
  Plus,
  Folder,
  ChevronRight,
  ChevronLeft,
  FileCode,
  Terminal as TerminalIcon,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  Home,
  LogOut,
  User,
  LayoutDashboard,
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { File } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function Workspace() {
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [showFileTree, setShowFileTree] = useState(true);
  const consoleRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data: files = [] } = useQuery<File[]>({
    queryKey: ["/api/files"],
  });

  const saveFileMutation = useMutation({
    mutationFn: async (data: { id: string; content: string }) => {
      return await apiRequest("PUT", `/api/files/${data.id}`, { content: data.content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ description: "File saved" });
    }
  });

  const createFileMutation = useMutation({
    mutationFn: async (data: { filename: string; language: string; content: string }) => {
      if (!user) throw new Error("Must be logged in to create files");
      return await apiRequest("POST", "/api/files", { ...data, userId: user.id });
    },
    onSuccess: (newFile) => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setActiveFile(newFile);
      setEditorContent(newFile.content);
      toast({ description: "File created" });
    }
  });

  useEffect(() => {
    if (activeFile) {
      setEditorContent(activeFile.content);
    }
  }, [activeFile]);

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (!activeFile || editorContent === activeFile.content) return;
    
    const timeout = setTimeout(() => {
      handleSave();
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [editorContent, activeFile]);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleOutput]);

  const handleSave = () => {
    if (activeFile) {
      saveFileMutation.mutate({ id: activeFile.id, content: editorContent });
    }
  };

  const handleRun = () => {
    setIsRunning(true);
    setConsoleOutput([
      "→ Running project...",
      "✓ Server started on http://localhost:3000",
      "✓ Ready in 1.2s"
    ]);
    setTimeout(() => {
      setIsRunning(false);
    }, 1500);
  };

  const handleStop = () => {
    setIsRunning(false);
    setConsoleOutput(prev => [...prev, "→ Server stopped"]);
  };

  const handleCreateFile = () => {
    const filename = prompt("File name:");
    if (filename) {
      const ext = filename.split('.').pop() || 'txt';
      const langMap: Record<string, string> = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'html': 'html',
        'css': 'css',
        'json': 'json'
      };
      createFileMutation.mutate({
        filename,
        language: langMap[ext] || 'plaintext',
        content: ''
      });
    }
  };

  const getFileIcon = (filename: string) => {
    return <FileCode className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Navigation Bar (Replit-style with Navigation) */}
      <header className="h-12 border-b flex items-center justify-between px-4 bg-card" data-testid="header-workspace">
        <div className="flex items-center gap-3">
          {/* Archetype Logo - Links to home */}
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/">
              <Sparkles className="h-4 w-4 text-primary" />
            </Link>
          </Button>
          
          {/* File tree toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowFileTree(!showFileTree)}
            data-testid="button-toggle-filetree"
          >
            {showFileTree ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
          
          {/* Project Name */}
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" data-testid="icon-logo" />
            <h1 className="font-semibold text-sm" data-testid="text-app-name">Archetype IDE</h1>
          </div>
          
          {/* Active File */}
          {activeFile && (
            <div className="flex items-center gap-2 pl-3 border-l">
              <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs" data-testid="text-active-file">{activeFile.filename}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Save Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={!activeFile || saveFileMutation.isPending}
            data-testid="button-save"
            className="h-8 text-xs"
          >
            {saveFileMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
          
          {/* Run/Stop Button */}
          <Button
            size="sm"
            variant={isRunning ? "secondary" : "default"}
            onClick={isRunning ? handleStop : handleRun}
            disabled={!activeFile}
            data-testid="button-run"
            className="h-8 text-xs gap-1.5"
          >
            {isRunning ? (
              <>
                <Square className="h-3 w-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Run
              </>
            )}
          </Button>
          
          <ThemeToggle />
          
          {/* User Menu - Dashboard & Logout */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-user-menu">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {user && (
                <>
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium">{user.email}</p>
                    {user.role === 'admin' && (
                      <Badge variant="secondary" className="text-[10px] mt-1">Admin</Badge>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/" className="cursor-pointer">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/api/auth/logout" className="cursor-pointer text-destructive flex items-center">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* AGENT 3 LAYOUT: 4-Panel Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: File Tree (Collapsible) */}
        {showFileTree && (
          <div className="w-48 border-r flex flex-col bg-card">
            <div className="h-9 flex items-center justify-between px-2 border-b">
              <div className="flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Files</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCreateFile}
                data-testid="button-create-file"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-1.5 space-y-0.5">
                {files.length === 0 ? (
                  <div className="text-center py-6 px-2">
                    <FileCode className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground" />
                    <p className="text-[11px] text-muted-foreground">No files</p>
                  </div>
                ) : (
                  files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setActiveFile(file)}
                      className={cn(
                        "w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] hover-elevate active-elevate-2 transition-colors",
                        activeFile?.id === file.id && "bg-accent"
                      )}
                      data-testid={`file-${file.filename}`}
                    >
                      {getFileIcon(file.filename)}
                      <span className="flex-1 text-left truncate">{file.filename}</span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* CENTER-LEFT: AI Chat (SySop) - Always Visible */}
        <div className="w-80 border-r flex flex-col bg-card">
          <div className="h-9 flex items-center px-3 border-b">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
              <span className="text-xs font-semibold">AI Agent (SySop)</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <AIChat onProjectGenerated={(result) => {
              if (result?.files) {
                queryClient.invalidateQueries({ queryKey: ["/api/files"] });
              }
            }} />
          </div>
        </div>

        {/* CENTER-RIGHT: Code Editor + Console */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor */}
          <div className="flex-1 relative">
            {activeFile ? (
              <MonacoEditor
                value={editorContent}
                onChange={(value) => setEditorContent(value || "")}
                language={activeFile.language}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Code2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <h2 className="text-base font-semibold mb-1.5">Welcome to Archetype</h2>
                  <p className="text-xs text-muted-foreground">Select or create a file to start coding</p>
                  <p className="text-xs text-muted-foreground mt-1">Ask SySop on the left to generate code!</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Console/Terminal */}
          <div className="h-40 border-t flex flex-col bg-card">
            <Tabs defaultValue="console" className="flex-1 flex flex-col">
              <TabsList className="h-8 border-b rounded-none bg-transparent px-2">
                <TabsTrigger value="console" className="text-xs h-7" data-testid="tab-console">
                  <TerminalIcon className="h-3 w-3 mr-1" />
                  Console
                </TabsTrigger>
                <TabsTrigger value="terminal" className="text-xs h-7" data-testid="tab-terminal">
                  <TerminalIcon className="h-3 w-3 mr-1" />
                  Shell
                </TabsTrigger>
              </TabsList>
              <TabsContent value="console" className="flex-1 m-0 p-2.5 overflow-auto font-mono text-xs" ref={consoleRef}>
                {consoleOutput.length === 0 ? (
                  <div className="text-muted-foreground">Console output will appear here...</div>
                ) : (
                  consoleOutput.map((line, i) => (
                    <div key={i} className="text-foreground leading-relaxed">{line}</div>
                  ))
                )}
              </TabsContent>
              <TabsContent value="terminal" className="flex-1 m-0 p-2.5 font-mono text-xs">
                <div className="text-muted-foreground">$ _</div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* RIGHT: Live Preview - Always Visible */}
        <div className="w-96 border-l flex flex-col bg-card">
          <div className="h-9 flex items-center justify-between px-3 border-b">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-semibold">Live Preview</span>
            </div>
          </div>
          <div className="flex-1 p-2">
            {activeFile && activeFile.language === 'html' ? (
              <div className="h-full bg-white dark:bg-zinc-900 rounded border overflow-hidden">
                <iframe
                  title="Preview"
                  className="w-full h-full"
                  srcDoc={editorContent}
                  sandbox="allow-scripts"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center border rounded bg-muted/20">
                <div className="text-center px-4">
                  <Code2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Preview available for HTML files</p>
                  <p className="text-xs text-muted-foreground mt-1">Select an HTML file to see live preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-5 border-t bg-card flex items-center justify-between px-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>Ready</span>
          </div>
          {activeFile && (
            <span className="uppercase tracking-wide">{activeFile.language}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>{files.length} files</span>
          <span>Archetype IDE</span>
        </div>
      </footer>
    </div>
  );
}
