import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute, useLocation } from "wouter";
import { UniversalChat } from "@/components/universal-chat";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { LivePreview } from "@/components/live-preview";
import { MonacoEditor } from "@/components/monaco-editor";
import { FileExplorer } from "@/components/file-explorer";
import { NewFileDialog } from "@/components/new-file-dialog";
import { LogViewer } from "@/components/log-viewer";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Code, 
  FolderTree, 
  Eye,
  Activity,
  ChevronDown,
  ArrowLeft,
  Plus,
  FileCode,
  Save,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { Project, File } from "@shared/schema";

export default function Builder() {
  const [activeTab, setActiveTab] = useState("build");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  
  // Files tab state (full editing)
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

  const { data: projects = [], isFetched: projectsFetched, isFetching: projectsFetching } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  // Fetch files for the current project
  const { data: files = [] } = useQuery<File[]>({
    queryKey: ["/api/projects", currentProjectId, "files"],
    enabled: isAuthenticated && !!currentProjectId,
    refetchInterval: 5000, // Auto-refresh to catch AI file changes
  });

  // Find current project
  const currentProject = projects.find(p => p.id === currentProjectId);

  // Validate project existence after projects query completes
  useEffect(() => {
    if (currentProjectId && projectsFetched && !projectsFetching && !currentProject && match) {
      toast({
        title: "Project not found",
        description: "The project you're looking for doesn't exist or you don't have access to it.",
        variant: "destructive",
      });
      setLocation("/dashboard");
    }
  }, [currentProjectId, projectsFetched, projectsFetching, currentProject, match, toast, setLocation]);

  const handleProjectGenerated = (result: any) => {
    if (result?.projectId) {
      setCurrentProjectId(result.projectId);
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

  const handleFileCreate = async (filename: string, language: string) => {
    if (!currentProjectId) {
      toast({
        title: "No project selected",
        description: "Please select a project first",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest("POST", "/api/files", {
        projectId: currentProjectId,
        filename,
        language,
        content: "",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/projects", currentProjectId, "files"] });
      
      toast({
        title: "File created",
        description: `${filename} has been created successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to create file",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-3 md:px-4" data-testid="header-builder">
        <div className="flex items-center gap-2 md:gap-3">
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
          
          {/* Project Switcher */}
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
          
          <Badge 
            variant="secondary" 
            className="hidden md:inline-flex bg-primary/10 text-primary border-primary/20 font-mono text-xs"
            data-testid="badge-lomu-ai"
          >
            LomuAI
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
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

          <div className="flex-1 overflow-hidden">
            {/* Build Tab - UniversalChat */}
            <TabsContent value="build" className="h-full m-0" data-testid="content-build">
              {currentProjectId ? (
                <UniversalChat 
                  targetContext="project"
                  projectId={currentProjectId}
                  onProjectGenerated={handleProjectGenerated}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-8">
                  <Card className="max-w-md">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                          <Sparkles className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">No Project Selected</h3>
                          <p className="text-sm text-muted-foreground">
                            Select a project from the dropdown above to start building with LomuAI
                          </p>
                        </div>
                        <Button 
                          onClick={() => setShowNewProjectDialog(true)}
                          className="w-full"
                          data-testid="button-create-project-empty"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create New Project
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="h-full m-0" data-testid="content-preview">
              {currentProjectId ? (
                <LivePreview projectId={currentProjectId} fileCount={files.length} />
              ) : (
                <div className="h-full flex items-center justify-center p-8">
                  <Card className="max-w-md">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-4">
                        <Eye className="w-12 h-12 text-muted-foreground mx-auto" />
                        <div>
                          <h3 className="font-semibold mb-2">No Active Project</h3>
                          <p className="text-sm text-muted-foreground">
                            Open a project to see the live preview
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files" className="h-full m-0" data-testid="content-files">
              <div className="h-full flex">
                <div className="w-64 border-r bg-card/50">
                  <FileExplorer
                    files={files}
                    activeFileId={activeFileId}
                    onFileSelect={handleFileSelect}
                    onCreateFile={handleCreateFile}
                  />
                </div>

                <div className="flex-1 flex flex-col">
                  {activeFile ? (
                    <>
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

                      <div className="flex-1 overflow-hidden">
                        <MonacoEditor
                          value={fileContent}
                          onChange={handleFileContentChange}
                          language={activeFile.language}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center max-w-sm">
                        <FileCode className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium mb-2">No file selected</p>
                        <p className="text-sm text-muted-foreground">
                          {files.length === 0 
                            ? "Generate files with AI chat to get started"
                            : "Select a file from the explorer to edit it"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="h-full m-0" data-testid="content-logs">
              <LogViewer projectId={currentProjectId ?? undefined} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Dialogs */}
      <NewProjectDialog 
        open={showNewProjectDialog}
        onOpenChange={setShowNewProjectDialog}
      />
      <NewFileDialog
        open={showNewFileDialog}
        onOpenChange={setShowNewFileDialog}
        onCreateFile={handleFileCreate}
      />
    </div>
  );
}
