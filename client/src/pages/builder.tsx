import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute, useLocation } from "wouter";
import { AIChat } from "@/components/ai-chat";
import { ProjectUpload } from "@/components/project-upload";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useAuth } from "@/hooks/useAuth";
import { LivePreview } from "@/components/live-preview";
import { MonacoEditor } from "@/components/monaco-editor";
import { FileExplorer } from "@/components/file-explorer";
import { NewFileDialog } from "@/components/new-file-dialog";
import { LogViewer } from "@/components/log-viewer";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Sparkles, 
  LayoutDashboard, 
  Code, 
  FolderTree, 
  Eye,
  Activity,
  History,
  LogIn,
  User,
  ChevronDown,
  ArrowLeft,
  Plus,
  FileCode,
  Save,
  CheckCircle2
} from "lucide-react";
import { Command, Project, File } from "@shared/schema";
import VersionHistory from "./version-history";

export default function Builder() {
  const [activeTab, setActiveTab] = useState("build");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  
  // Files tab state (full editing)
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Build tab inline preview state (separate from Files tab)
  const [inlineFileId, setInlineFileId] = useState<string | null>(null);
  const [inlineFileContent, setInlineFileContent] = useState<string>("");
  const [inlineHasUnsavedChanges, setInlineHasUnsavedChanges] = useState(false);
  
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Check if projectId is in the URL (/builder/:projectId)
  const [match, params] = useRoute("/builder/:projectId");
  
  // Set currentProjectId from URL params
  useEffect(() => {
    if (match && params?.projectId) {
      setCurrentProjectId(params.projectId);
    }
  }, [match, params]);

  const { data: commands = [] } = useQuery<Command[]>({
    queryKey: ["/api/commands"],
  });

  const { data: projects = [], isFetched: projectsFetched, isFetching: projectsFetching } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  // Fetch files for the current project only (project-scoped endpoint)
  const { data: files = [], refetch: refetchFiles } = useQuery<File[]>({
    queryKey: ["/api/projects", currentProjectId, "files"],
    enabled: isAuthenticated && !!currentProjectId, // Only fetch when authenticated AND we have a projectId
    refetchInterval: 5000, // Auto-refresh every 5 seconds to catch SySop file changes
  });

  // Log when files are loaded (replaces deprecated onSuccess)
  useEffect(() => {
    if (files && files.length > 0) {
      console.log(`📂 [FILES-LOADED] Fetched ${files.length} files for project ${currentProjectId}`, 
        files.map((f: File) => ({ 
          id: f.id, 
          filename: f.filename, 
          language: f.language,
          hasContent: !!f.content,
          contentLength: f.content?.length || 0
        }))
      );
    }
  }, [files, currentProjectId]);

  // Find current project
  const currentProject = projects.find(p => p.id === currentProjectId);

  // Validate project existence after projects query completes
  // Now that we properly invalidate projects cache after creation, this should work reliably
  useEffect(() => {
    // Only validate if:
    // 1. We have a projectId from URL
    // 2. Projects query has completed AND is not currently refetching (isFetched && !isFetching)
    // 3. Project doesn't exist in the list
    // 4. We're at a builder route (not just /builder)
    if (currentProjectId && projectsFetched && !projectsFetching && !currentProject && match) {
      // Project doesn't exist - show error and redirect
      toast({
        title: "Project not found",
        description: "The project you're looking for doesn't exist or you don't have access to it.",
        variant: "destructive",
      });
      setLocation("/dashboard");
    }
  }, [currentProjectId, projectsFetched, projectsFetching, currentProject, match, toast, setLocation]);

  // Listen for WebSocket file updates
  useEffect(() => {
    if (!currentProjectId) {
      console.log('⏸️  [WEBSOCKET] No project selected, skipping WebSocket connection');
      return;
    }

    // Build WebSocket URL - use /ws endpoint on same host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log(`🔌 [WEBSOCKET] Connecting to ${wsUrl} for project ${currentProjectId}`);
    
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (error) {
      console.error('❌ [WEBSOCKET] Failed to create WebSocket:', error);
      return;
    }
    
    ws.onopen = () => {
      console.log('✅ [WEBSOCKET] Connected successfully for file updates');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 [WEBSOCKET] Received message:', data);
        
        // Refetch files when they're updated for this project
        if (data.type === 'files_updated' && data.projectId === currentProjectId) {
          console.log(`📡 [WEBSOCKET] Files updated for project ${currentProjectId}, refetching...`);
          refetchFiles();
        }
      } catch (error) {
        console.error('❌ [WEBSOCKET] Message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ [WEBSOCKET] Connection error:', error);
    };

    ws.onclose = (event) => {
      console.log(`🔌 [WEBSOCKET] Disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`);
    };

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('🔌 [WEBSOCKET] Closing connection');
        ws.close();
      }
    };
  }, [currentProjectId, refetchFiles]);

  const handleProjectGenerated = (result: any) => {
    if (result?.projectId) {
      setCurrentProjectId(result.projectId);
      // Update URL to persist project selection
      setLocation(`/builder/${result.projectId}`);
    }
  };

  const handleProjectSwitch = (projectId: string) => {
    setCurrentProjectId(projectId);
    setLocation(`/builder/${projectId}`);
    setActiveFileId(null);
    setFileContent("");
    setHasUnsavedChanges(false);
    setInlineFileId(null);
    setInlineFileContent("");
    setInlineHasUnsavedChanges(false);
  };

  const activeFile = files.find(f => f.id === activeFileId);
  const inlineFile = files.find(f => f.id === inlineFileId);

  // File save mutation
  const saveFileMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      return await apiRequest("PUT", `/api/files/${fileId}`, { content });
    },
    onSuccess: () => {
      // Invalidate project-specific files query
      queryClient.invalidateQueries({ queryKey: ["/api/projects", currentProjectId, "files"] });
      setHasUnsavedChanges(false);
      toast({
        title: "File saved",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save file",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    // Save current file if there are unsaved changes
    if (hasUnsavedChanges && activeFileId) {
      saveFileMutation.mutate({ fileId: activeFileId, content: fileContent });
    }
    
    console.log(`📄 [FILE-SELECT] Selected file:`, { 
      id: file.id, 
      filename: file.filename, 
      language: file.language,
      contentLength: file.content?.length || 0,
      contentPreview: file.content?.substring(0, 100) || '(empty)'
    });
    
    setActiveFileId(file.id);
    setFileContent(file.content);
    setHasUnsavedChanges(false);
  };

  const handleFileContentChange = (value: string | undefined) => {
    if (value !== undefined) {
      setFileContent(value);
      setHasUnsavedChanges(value !== activeFile?.content);
    }
  };

  const handleSaveFile = () => {
    if (activeFileId && hasUnsavedChanges) {
      saveFileMutation.mutate({ fileId: activeFileId, content: fileContent });
    }
  };

  const handleCreateFile = () => {
    setShowNewFileDialog(true);
  };

  // Inline file handlers for Build tab
  const handleInlineFileSelect = (file: File) => {
    if (inlineHasUnsavedChanges && inlineFileId) {
      saveFileMutation.mutate({ fileId: inlineFileId, content: inlineFileContent });
    }
    
    setInlineFileId(file.id);
    setInlineFileContent(file.content);
    setInlineHasUnsavedChanges(false);
  };

  const handleInlineFileContentChange = (value: string | undefined) => {
    if (value !== undefined) {
      setInlineFileContent(value);
      setInlineHasUnsavedChanges(value !== inlineFile?.content);
    }
  };

  const handleInlineSaveFile = () => {
    if (inlineFileId && inlineHasUnsavedChanges) {
      saveFileMutation.mutate({ fileId: inlineFileId, content: inlineFileContent });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Mobile-First Top Bar */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-3 md:px-4" data-testid="header-builder">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Back to Dashboard */}
          <Button 
            variant="ghost" 
            size="sm"
            className="min-h-[44px] gap-2"
            data-testid="button-back-dashboard"
            asChild
          >
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </Button>
          
          {/* Project Switcher - Always show when authenticated */}
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="gap-2 min-h-[44px] max-w-[200px] justify-between"
                  data-testid="button-project-switcher"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Code className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate text-sm">
                      {currentProject?.name || (projects.length > 0 ? "Select Project" : "No Projects")}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[250px]">
                {projects.length > 0 ? (
                  <>
                    {projects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => handleProjectSwitch(project.id)}
                        className="gap-2"
                        data-testid={`project-item-${project.id}`}
                      >
                        <Code className="w-4 h-4" />
                        <span className="truncate">{project.name}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                ) : (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No projects yet. Create one below!
                  </div>
                )}
                <DropdownMenuItem
                  onClick={() => setShowNewProjectDialog(true)}
                  className="gap-2"
                  data-testid="button-new-project"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* SySop AI Badge */}
          <Badge 
            variant="secondary" 
            className="hidden md:inline-flex bg-primary/10 text-primary border-primary/20 font-mono text-xs"
            data-testid="badge-sysop-ai"
          >
            SySop AI
          </Badge>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Tab-Based Navigation (Simplified like Replit) */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          {/* Tab Bar - Clean and Minimal */}
          <div className="border-b bg-card px-2 sm:px-4">
            <TabsList className="bg-transparent h-12 p-0 gap-1 w-full justify-start overflow-x-auto" data-testid="tabs-main">
              <TabsTrigger 
                value="build" 
                className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 rounded-t rounded-b-none min-h-[44px] px-4 flex-shrink-0"
                data-testid="tab-build"
              >
                <Code className="w-4 h-4" />
                <span>AI Build</span>
              </TabsTrigger>
              <TabsTrigger 
                value="preview" 
                className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 rounded-t rounded-b-none min-h-[44px] px-4 flex-shrink-0"
                data-testid="tab-preview"
              >
                <Eye className="w-4 h-4" />
                <span>Preview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="files" 
                className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 rounded-t rounded-b-none min-h-[44px] px-4 flex-shrink-0"
                data-testid="tab-files"
              >
                <FolderTree className="w-4 h-4" />
                <span className="hidden sm:inline">Files</span>
              </TabsTrigger>
              <TabsTrigger 
                value="logs" 
                className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 rounded-t rounded-b-none min-h-[44px] px-4 flex-shrink-0"
                data-testid="tab-logs"
              >
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Logs</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {/* Build Tab (Split-Pane: Chat + Files) */}
            <TabsContent value="build" className="h-full m-0" data-testid="content-build">
              <ResizablePanelGroup direction="horizontal" className="h-full">
                {/* Left Panel: AI Chat (60%) */}
                <ResizablePanel defaultSize={60} minSize={40}>
                  <div className="h-full overflow-hidden">
                    <AIChat 
                      onProjectGenerated={handleProjectGenerated}
                      currentProjectId={currentProjectId}
                    />
                  </div>
                </ResizablePanel>

                {/* Resize Handle */}
                <ResizableHandle withHandle />

                {/* Right Panel: File Explorer + Inline Monaco (40%) */}
                <ResizablePanel defaultSize={40} minSize={30}>
                  <div className="h-full flex flex-col">
                    {/* File Explorer (top portion) */}
                    <div className="h-64 border-b bg-card/50">
                      <FileExplorer
                        files={files}
                        activeFileId={inlineFileId}
                        onFileSelect={handleInlineFileSelect}
                        onCreateFile={handleCreateFile}
                      />
                    </div>

                    {/* Inline Monaco Editor (bottom portion) */}
                    <div className="flex-1 overflow-hidden">
                      {inlineFile ? (
                        <div className="h-full flex flex-col">
                          {/* Compact Editor Header */}
                          <div className="h-12 border-b px-3 flex items-center justify-between bg-card/50">
                            <div className="flex items-center gap-2">
                              <FileCode className="w-4 h-4 text-primary" />
                              <span className="text-sm font-medium">{inlineFile.filename}</span>
                              {inlineHasUnsavedChanges && (
                                <Badge variant="outline" className="text-xs border-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                                  Unsaved
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleInlineSaveFile}
                              disabled={!inlineHasUnsavedChanges || saveFileMutation.isPending}
                              data-testid="button-save-inline-file"
                            >
                              {saveFileMutation.isPending ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1 animate-spin" />
                                  <span className="text-xs">Saving...</span>
                                </>
                              ) : (
                                <>
                                  <Save className="w-3 h-3 mr-1" />
                                  <span className="text-xs">Save</span>
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Compact Monaco Editor */}
                          <div className="flex-1 overflow-hidden">
                            <MonacoEditor
                              value={inlineFileContent}
                              onChange={handleInlineFileContentChange}
                              language={inlineFile.language}
                              compact={true}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center p-4">
                          <div className="text-center max-w-xs">
                            <FileCode className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                            <p className="text-sm font-medium mb-1">No file selected</p>
                            <p className="text-xs text-muted-foreground">
                              {files.length === 0 
                                ? "Generate files with AI chat to get started"
                                : "Click a file above to preview it here"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="h-full m-0" data-testid="content-preview">
              <LivePreview projectId={currentProjectId} fileCount={files.length} />
            </TabsContent>

            {/* Files Tab - File Explorer + Monaco Editor */}
            <TabsContent value="files" className="h-full m-0" data-testid="content-files">
              <div className="h-full flex">
                {/* File Explorer Sidebar */}
                <div className="w-64 border-r bg-card/50">
                  <FileExplorer
                    files={files}
                    activeFileId={activeFileId}
                    onFileSelect={handleFileSelect}
                    onCreateFile={handleCreateFile}
                  />
                </div>

                {/* Monaco Editor */}
                <div className="flex-1 flex flex-col">
                  {activeFile ? (
                    <>
                      {/* Editor Header */}
                      <div className="h-14 border-b px-4 flex items-center justify-between bg-card/50">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold">{activeFile.filename}</span>
                          {activeFile.path && (
                            <span className="text-xs text-muted-foreground">/{activeFile.path}</span>
                          )}
                          {hasUnsavedChanges && (
                            <Badge variant="outline" className="text-xs border-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                              Unsaved
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={handleSaveFile}
                            disabled={!hasUnsavedChanges || saveFileMutation.isPending}
                            data-testid="button-save-file"
                          >
                            {saveFileMutation.isPending ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Editor */}
                      <div className="flex-1 overflow-hidden">
                        <MonacoEditor
                          value={fileContent}
                          onChange={handleFileContentChange}
                          language={activeFile.language}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center p-6">
                      <div className="text-center max-w-md">
                        <FileCode className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">
                          {files.length === 0 ? "No Files Yet" : "Select a File"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {files.length === 0 
                            ? "Use the AI Build tab to generate your project, or create a new file"
                            : "Click on a file in the explorer to view and edit it"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog 
        open={showNewProjectDialog} 
        onOpenChange={setShowNewProjectDialog}
      />

      {/* New File Dialog */}
      <NewFileDialog
        open={showNewFileDialog}
        onOpenChange={setShowNewFileDialog}
        onCreateFile={(filename, language) => {
          console.log("Create file:", filename, language);
          toast({ description: "File creation coming soon!" });
        }}
      />
    </div>
  );
}
