import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { MonacoEditor } from "@/components/monaco-editor";
import { SplitEditor } from "@/components/split-editor";
import { useSplitEditor } from "@/hooks/useSplitEditor";
import { ThemeToggle } from "@/components/theme-toggle";
import { UniversalChat } from "@/components/universal-chat";
import { MobileWorkspace } from "@/components/mobile-workspace";
import { LivePreview } from "@/components/live-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useVersion } from "@/providers/version-provider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Play,
  Square,
  Plus,
  Folder,
  FileCode,
  Terminal as TerminalIcon,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Home,
  LogOut,
  User,
  LayoutDashboard,
  ArrowLeft,
  Menu,
} from "lucide-react";
import type { File } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function Workspace() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [location, setLocation] = useLocation();
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [showFileTree, setShowFileTree] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [showMobileFileExplorer, setShowMobileFileExplorer] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isMobile, version } = useVersion();

  // Fetch project data if projectId provided
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
  });

  // Fetch tasks for this project
  const { data: tasksData } = useQuery({
    queryKey: [`/api/projects/${projectId}/tasks`],
    enabled: !!projectId,
  });

  // RBAC: Determine user role and access
  const isProjectOwner = projectId && project?.ownerId === user?.id;
  const isAdmin = user?.role === 'admin';
  const isSuperAdmin = user?.isOwner;
  const isPlatformHealing = projectId && project?.type === 'platform' && isSuperAdmin;

  let userRole: 'owner' | 'member' | 'admin' | 'super_admin' = 'member';
  if (isSuperAdmin) userRole = 'super_admin';
  else if (isAdmin) userRole = 'admin';
  else if (isProjectOwner) userRole = 'owner';

  const hasAccess = isProjectOwner || isAdmin || isSuperAdmin;

  // If projectId provided and has access, use new Replit-style layout
  if (projectId && project) {
    if (!hasAccess) {
      return (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="font-semibold text-red-600">Access Denied</p>
            <p className="text-sm text-muted-foreground">You don't have permission to access this project</p>
          </div>
        </div>
      );
    }

    if (projectLoading) {
      return (
        <div className="h-screen flex items-center justify-center">
          <Skeleton className="w-full h-full" />
        </div>
      );
    }

    // Use Replit-style layout for projects
    return (
      <WorkspaceLayout
        projectId={projectId}
        projectName={project.name}
        mode={isPlatformHealing ? 'platform-healing' : 'project'}
        isAdmin={isSuperAdmin}
        userRole={userRole}
        tasks={(tasksData as any)?.items || []}
        activityLog={(tasksData as any)?.activity || []}
        onTaskSelect={(taskId) => setSelectedTaskId(taskId)}
        onEditorChange={(content) => setEditorContent(content)}
      >
        {activeFile ? (
          <MonacoEditor
            value={editorContent}
            onChange={setEditorContent}
            language={activeFile.language || 'javascript'}
            theme="vs-light"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'JetBrains Mono',
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">Select a file to start editing</p>
            </div>
          </div>
        )}
      </WorkspaceLayout>
    );
  }

  // Fallback to original workspace for backward compatibility

  const { data: files = [] } = useQuery<File[]>({
    queryKey: ["/api/files"],
  });

  // Get active project session for preview
  const { data: activeSession } = useQuery<{ activeProjectId: string | null; project: any | null }>({
    queryKey: ["/api/projects/active-session"],
    enabled: !!user,
  });

  // Split editor hook for desktop
  const splitEditor = useSplitEditor(files);

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

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return await apiRequest("DELETE", `/api/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setActiveFile(null);
      setEditorContent("");
      toast({ description: "File deleted" });
    }
  });

  useEffect(() => {
    if (activeFile) {
      setEditorContent(activeFile.content);
    }
  }, [activeFile]);

  // Auto-save on content change (debounced) - for mobile single editor
  useEffect(() => {
    if (isMobile && activeFile && editorContent !== activeFile.content) {
      const timeout = setTimeout(() => {
        handleSave();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [editorContent, activeFile, isMobile]);

  // Auto-save for split editor (desktop)
  useEffect(() => {
    if (!isMobile) {
      const modifiedFiles = splitEditor.getModifiedFiles();
      if (modifiedFiles.length === 0) return;
      
      const timeout = setTimeout(() => {
        handleSplitSave();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [splitEditor.leftContent, splitEditor.rightContent, isMobile]);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleOutput]);

  const handleSave = async (fileId?: string, content?: string) => {
    const id = fileId || activeFile?.id;
    const contentToSave = content || editorContent;
    if (id) {
      await saveFileMutation.mutateAsync({ id, content: contentToSave });
    }
  };

  const handleSplitSave = () => {
    const modifiedFiles = splitEditor.getModifiedFiles();
    modifiedFiles.forEach(file => {
      saveFileMutation.mutate({ id: file.id, content: file.content });
    });
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

  // Mobile-first workspace with bottom tabs
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <MobileWorkspace
          projectId={activeSession?.activeProjectId || null}
          files={files.map(f => ({
            id: f.id,
            filename: f.filename,
            content: f.content,
            language: f.language
          }))}
          activeFile={activeFile ? {
            id: activeFile.id,
            filename: activeFile.filename,
            content: activeFile.content,
            language: activeFile.language
          } : null}
          onFileSelect={(file) => {
            const fullFile = files.find(f => f.id === file.id);
            if (fullFile) {
              setActiveFile(fullFile);
              setEditorContent(file.content);
            }
          }}
          onFileCreate={handleCreateFile}
          onFileUpdate={handleSave}
          onFileDelete={(fileId) => deleteFileMutation.mutate(fileId)}
        />
      </div>
    );
  }

  // Desktop workspace with 5-panel layout
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Navigation Bar (Replit-style with Navigation) */}
      <header className="h-12 border-b flex items-center justify-between px-4 bg-card" data-testid="header-workspace">
        <div className="flex items-center gap-3">
          {/* Back to Dashboard */}
          <Button variant="ghost" size="sm" className="h-8 gap-2" asChild data-testid="button-back-dashboard">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Dashboard</span>
            </Link>
          </Button>
          
          {/* Hamburger menu (mobile only) */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden"
              onClick={() => setShowMobileFileExplorer(true)}
              data-testid="button-mobile-menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          
          {/* Preview toggle (mobile) */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden"
              onClick={() => setShowPreview(!showPreview)}
              data-testid="button-toggle-preview-mobile"
            >
              {showPreview ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
            </Button>
          )}
          
          {/* Panel toggles (desktop only) */}
          {!isMobile && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden md:flex"
                onClick={() => setShowFileTree(!showFileTree)}
                data-testid="button-toggle-filetree"
              >
                {showFileTree ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden md:flex"
                onClick={() => setShowPreview(!showPreview)}
                data-testid="button-toggle-preview"
              >
                {showPreview ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
              </Button>
            </>
          )}
          
          {/* Active File */}
          {splitEditor.getActiveFile() && (
            <div className="flex items-center gap-2 pl-3 border-l">
              <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs" data-testid="text-active-file">{splitEditor.getActiveFile()?.filename}</span>
              {splitEditor.splitEnabled && splitEditor.rightFileId && (
                <>
                  <span className="text-xs text-muted-foreground">/</span>
                  <span className="text-xs" data-testid="text-right-file">{files.find(f => f.id === splitEditor.rightFileId)?.filename}</span>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Save Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleSplitSave}
            disabled={splitEditor.getModifiedFiles().length === 0 || saveFileMutation.isPending}
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
            disabled={!splitEditor.getActiveFile()}
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

      {/* Mobile File Explorer Sheet */}
      <Sheet open={showMobileFileExplorer} onOpenChange={setShowMobileFileExplorer}>
        <SheetContent side="left" className="w-64 p-0 h-full">
          <div className="h-full flex flex-col bg-card overflow-hidden">
            <div className="h-14 flex items-center justify-between px-4 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Files</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleCreateFile}
                data-testid="button-create-file-mobile"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-1">
                {files.length === 0 ? (
                  <div className="text-center py-8">
                    <FileCode className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">No files</p>
                  </div>
                ) : (
                  files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setActiveFile(file);
                        setShowMobileFileExplorer(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded text-sm hover-elevate active-elevate-2 transition-colors",
                        activeFile?.id === file.id && "bg-accent"
                      )}
                      data-testid={`file-mobile-${file.filename}`}
                    >
                      {getFileIcon(file.filename)}
                      <span className="flex-1 text-left truncate">{file.filename}</span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* AGENT 5 LAYOUT: 5-Panel Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: File Tree (Desktop only - Collapsible) */}
        {!isMobile && showFileTree && (
          <div className="w-48 border-r flex flex-col bg-card hidden md:flex">
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

            <ScrollArea className="flex-1 min-h-0">
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
                      onClick={() => splitEditor.setLeftFile(file.id)}
                      className={cn(
                        "w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] hover-elevate active-elevate-2 transition-colors",
                        splitEditor.leftFileId === file.id && "bg-accent"
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

        {/* CENTER-LEFT: AI Chat (Lomu) - Always Visible */}
        <div className="w-80 border-r flex flex-col bg-card overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4" />
                Talk & Build
              </h2>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeSession?.activeProjectId ? (
                <UniversalChat 
                  targetContext="project"
                  projectId={activeSession.activeProjectId}
                  onProjectGenerated={(result) => {
                    if (result?.files) {
                      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
                    }
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-8">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center space-y-4">
                        <Sparkles className="w-12 h-12 text-muted-foreground mx-auto" />
                        <div>
                          <h3 className="font-semibold mb-2">No Active Project</h3>
                          <p className="text-sm text-muted-foreground">
                            Open a project to start coding with LomuAI
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CENTER-RIGHT: Code Editor + Console */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Split Editor */}
          <div className="flex-1 relative">
            <SplitEditor
              files={files}
              leftFileId={splitEditor.leftFileId}
              rightFileId={splitEditor.rightFileId}
              splitEnabled={splitEditor.splitEnabled}
              onLeftFileChange={splitEditor.setLeftFile}
              onRightFileChange={splitEditor.setRightFile}
              onLeftContentChange={splitEditor.setLeftContent}
              onRightContentChange={splitEditor.setRightContent}
              onSplitToggle={splitEditor.toggleSplit}
              leftContent={splitEditor.leftContent}
              rightContent={splitEditor.rightContent}
            />
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
                <TabsTrigger value="migrations" className="text-xs h-7" data-testid="tab-migrations">
                  <Database className="h-3 w-3 mr-1" />
                  Migrations
                </TabsTrigger>
                <TabsTrigger value="git" className="text-xs h-7" data-testid="tab-git">
                  <GitBranch className="h-3 w-3 mr-1" />
                  Git
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
              <TabsContent value="migrations" className="flex-1 m-0 p-2.5 overflow-auto">
                {user && <MigrationsPanel projectId={user.id} />}
              </TabsContent>
              <TabsContent value="git" className="flex-1 m-0 overflow-hidden">
                <GitPanel />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* RIGHT: Live Preview - Collapsible */}
        {showPreview && (
          <div className="w-96 border-l flex flex-col bg-card overflow-hidden">
            {activeSession?.activeProjectId ? (
              <LivePreview 
                projectId={activeSession.activeProjectId}
                fileCount={files.length}
              />
            ) : (
              <div className="h-full flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                  <Eye className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Active Project</h3>
                  <p className="text-sm text-muted-foreground">
                    Select or create a project to see a live preview
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
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
          <span>Lomu IDE</span>
        </div>
      </footer>
    </div>
  );
}