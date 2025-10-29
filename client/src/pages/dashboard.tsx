import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  FolderCode,
  Calendar,
  FileCode,
  Eye,
  Trash2,
  Search,
  Grid3x3,
  List,
  Sparkles,
  LayoutTemplate,
  Code2,
  GitCommit
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplateGallery } from "@/components/template-gallery";
import { ProjectUpload } from "@/components/project-upload";
import { OnboardingTour } from "@/components/onboarding-tour";
import { NewProjectDialog } from "@/components/new-project-dialog";

type Project = {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  fileCount?: number;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { toast } = useToast();

  // Check if this is first time user
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('archetype_onboarding_complete');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project deleted",
        description: "The project has been deleted successfully.",
      });
      setProjectToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = () => {
    setShowNewProjectDialog(true);
  };

  const handleOpenProject = (projectId: string) => {
    setLocation(`/builder/${projectId}`);
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('archetype_onboarding_complete', 'true');
    setShowOnboarding(false);
    
    // Check if there's a quickstart prompt
    const quickstartPrompt = localStorage.getItem('archetype_quickstart_prompt');
    if (quickstartPrompt) {
      localStorage.setItem('archetype_ai_prompt', quickstartPrompt);
      localStorage.removeItem('archetype_quickstart_prompt');
      setLocation('/builder');
    }
  };

  return (
    <>
      {showOnboarding && <OnboardingTour onComplete={handleOnboardingComplete} />}
      
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Projects</h1>
              <p className="text-muted-foreground">
                Manage and organize all your AI-generated projects
              </p>
            </div>
            {/* Glowing 123 Commits Indicator */}
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
              <div className="relative px-4 py-2 bg-black rounded-lg leading-none flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-white" />
                <span className="text-white font-bold">123</span>
                <span className="text-gray-300 text-sm">commits</span>
              </div>
              <style jsx>{`
                @keyframes pulse {
                  0%, 100% {
                    opacity: 0.75;
                  }
                  50% {
                    opacity: 1;
                  }
                }
                .animate-pulse {
                  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
              `}</style>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Button
              onClick={() => setLocation("/workspace")}
              size="lg"
              variant="default"
              className="w-full sm:w-auto bg-primary"
              data-testid="button-open-workspace"
            >
              <Code2 className="w-4 h-4 mr-2" />
              <span>Open IDE Workspace</span>
            </Button>
            <Button
              onClick={() => setShowTemplateGallery(true)}
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              data-testid="button-browse-templates"
            >
              <LayoutTemplate className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Browse Templates</span>
              <span className="sm:hidden">Templates</span>
            </Button>
            <Button
              onClick={handleCreateProject}
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              data-testid="button-create-project"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* Project Upload */}
        <ProjectUpload />

        {/* Search and View Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-projects"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Projects Display */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-primary animate-pulse" />
              <p className="text-muted-foreground">Loading projects...</p>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="p-6 sm:p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <FolderCode className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? "No projects found" : "No projects yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              {searchQuery
                ? "Try adjusting your search query"
                : "Get started by creating your first AI-powered project"}
            </p>
            {!searchQuery && (
              <Button 
                onClick={handleCreateProject} 
                size="lg"
                className="max-w-full sm:w-auto"
                data-testid="button-start-first-project"
              >
                <Plus className="w-4 h-4 mr-2 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">Create Your First Project</span>
                <span className="sm:hidden whitespace-nowrap">Create Project</span>
              </Button>
            )}
          </Card>
        ) : (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                : "space-y-4"
            )}
          >
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className="hover-elevate active-elevate-2 transition-all cursor-pointer group"
                onClick={() => handleOpenProject(project.id)}
                data-testid={`card-project-${project.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="truncate">{project.name}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {project.description || "No description"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      <FileCode className="w-3 h-3 mr-1" />
                      {project.fileCount || 0}
                    </Badge>
                  </div>
                </CardHeader>
                <CardFooter className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProject(project.id);
                      }}
                      data-testid={`button-view-project-${project.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(project);
                      }}
                      data-testid={`button-delete-project-${project.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Template Gallery Modal */}
      <TemplateGallery 
        open={showTemplateGallery} 
        onOpenChange={setShowTemplateGallery}
      />

      {/* New Project Dialog */}
      <NewProjectDialog 
        open={showNewProjectDialog} 
        onOpenChange={setShowNewProjectDialog}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This action cannot be undone.
              All files, commands, and chat messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projectToDelete && deleteMutation.mutate(projectToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </>
  );
}