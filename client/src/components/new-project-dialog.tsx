import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Sparkles } from "lucide-react";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectType, setProjectType] = useState("webapp");

  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; type: string }) => {
      return await apiRequest("POST", "/api/projects", data);
    },
    onSuccess: (project: any) => {
      toast({
        title: "Project Created!",
        description: `${project.name} is ready for development`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      setProjectName("");
      setProjectDescription("");
      setProjectType("webapp");
      onOpenChange(false);
      
      setLocation(`/builder/${project.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create project",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectName.trim()) {
      toast({
        title: "Project name required",
        description: "Please enter a name for your project",
        variant: "destructive",
      });
      return;
    }

    createProjectMutation.mutate({
      name: projectName.trim(),
      description: projectDescription.trim(),
      type: projectType,
    });
  };

  const handleCancel = () => {
    setProjectName("");
    setProjectDescription("");
    setProjectType("webapp");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-new-project">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Create New Project
            </DialogTitle>
            <DialogDescription>
              Start a new AI-powered project. Give it a name and Lomu will help you build it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                placeholder="My Awesome App"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                data-testid="input-project-name"
                disabled={createProjectMutation.isPending}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                placeholder="A brief description of what this project does..."
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                data-testid="input-project-description"
                disabled={createProjectMutation.isPending}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-type">Project Type</Label>
              <Select
                value={projectType}
                onValueChange={setProjectType}
                disabled={createProjectMutation.isPending}
              >
                <SelectTrigger id="project-type" data-testid="select-project-type">
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="webapp">Web Application</SelectItem>
                  <SelectItem value="game">Game</SelectItem>
                  <SelectItem value="api">API / Backend</SelectItem>
                  <SelectItem value="tool">Tool / Utility</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createProjectMutation.isPending}
              data-testid="button-cancel-project"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProjectMutation.isPending || !projectName.trim()}
              data-testid="button-create-project"
            >
              {createProjectMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
