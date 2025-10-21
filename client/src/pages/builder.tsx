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
import { useAuth } from "@/hooks/useAuth";
import { LivePreview } from "@/components/live-preview";
import { MonacoEditor } from "@/components/monaco-editor";
import { FileExplorer } from "@/components/file-explorer";
import { NewFileDialog } from "@/components/new-file-dialog";
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
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
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

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  const { data: allFiles = [] } = useQuery<File[]>({
    queryKey: ["/api/files"],
    enabled: isAuthenticated,
  });

  // Filter files by current project
  const files = currentProjectId 
    ? allFiles.filter(f => f.projectId === currentProjectId)
    : [];

  const currentProject = projects.find(p => p.id === currentProjectId);

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
  };

  const activeFile = files.find(f => f.id === activeFileId);

  // File save mutation
  const saveFileMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      return await apiRequest("PUT", `/api/files/${fileId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
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
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {/* Build Tab (Main Interface) */}
            <TabsContent value="build" className="h-full m-0" data-testid="content-build">
              <div className="h-full flex flex-col">
                {/* AI Chat Component (Full Height) */}
                <div className="flex-1 overflow-hidden">
                  <AIChat 
                    onProjectGenerated={handleProjectGenerated}
                    currentProjectId={currentProjectId}
                  />
                </div>
              </div>
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
