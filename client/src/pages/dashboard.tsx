import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Code2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplateGallery } from "@/components/template-gallery";

type Project = {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = () => {
    setLocation("/builder");
  };

  const handleOpenProject = (projectId: string) => {
    setLocation(`/builder/${projectId}`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Projects</h1>
            <p className="text-muted-foreground">
              Manage and organize all your AI-generated projects
            </p>
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
                      {/* TODO: Add file count */}
                      0
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
                        // TODO: Implement delete
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
    </div>
  );
}
