import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Rocket, AlertCircle } from "lucide-react";
import type { Project } from "@shared/schema";

interface NewDeploymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewDeploymentModal({ open, onOpenChange }: NewDeploymentModalProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [projectId, setProjectId] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [environment, setEnvironment] = useState<"production" | "preview">("production");
  const [branch, setBranch] = useState("main");
  const [subdomainError, setSubdomainError] = useState("");

  // Fetch user's projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: open,
  });

  // Create deployment mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      projectId: string;
      subdomain: string;
      environment: string;
      branch: string;
    }) => {
      return apiRequest('POST', '/api/deployments', data);
    },
    onSuccess: (deployment: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments'] });
      toast({
        title: "Deployment created",
        description: "Your project is being built and deployed",
      });
      onOpenChange(false);
      navigate(`/deployments/${deployment.id}`);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create deployment",
      });
    },
  });

  const resetForm = () => {
    setProjectId("");
    setSubdomain("");
    setEnvironment("production");
    setBranch("main");
    setSubdomainError("");
  };

  const validateSubdomain = (value: string) => {
    // Subdomain validation: lowercase alphanumeric + hyphens, 3-63 chars
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

    if (!value) {
      setSubdomainError("Subdomain is required");
      return false;
    }

    if (value.length < 3 || value.length > 63) {
      setSubdomainError("Subdomain must be 3-63 characters");
      return false;
    }

    if (!subdomainRegex.test(value)) {
      setSubdomainError("Subdomain must be lowercase alphanumeric with hyphens");
      return false;
    }

    setSubdomainError("");
    return true;
  };

  const handleSubdomainChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(cleaned);
    if (cleaned) {
      validateSubdomain(cleaned);
    } else {
      setSubdomainError("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a project",
      });
      return;
    }

    if (!validateSubdomain(subdomain)) {
      return;
    }

    createMutation.mutate({
      projectId,
      subdomain,
      environment,
      branch: branch || "main",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-new-deployment">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            New Deployment
          </DialogTitle>
          <DialogDescription>
            Deploy your project to production with Cloudflare Pages
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project">Project *</Label>
            {projectsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                No projects available. Create a project first.
              </div>
            ) : (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="project" data-testid="select-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Subdomain */}
          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="subdomain"
                placeholder="my-awesome-project"
                value={subdomain}
                onChange={(e) => handleSubdomainChange(e.target.value)}
                className={subdomainError ? "border-destructive" : ""}
                data-testid="input-subdomain"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                .beehive.app
              </span>
            </div>
            {subdomainError && (
              <p className="text-sm text-destructive" data-testid="text-subdomain-error">
                {subdomainError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              3-63 characters, lowercase letters, numbers, and hyphens
            </p>
          </div>

          {/* Environment */}
          <div className="space-y-2">
            <Label>Environment *</Label>
            <RadioGroup
              value={environment}
              onValueChange={(value) => setEnvironment(value as "production" | "preview")}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="production"
                  id="production"
                  className="peer sr-only"
                  data-testid="radio-production"
                />
                <Label
                  htmlFor="production"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover-elevate peer-data-[state=checked]:border-primary cursor-pointer"
                >
                  <div className="text-center">
                    <div className="mb-1 text-sm font-semibold">🚀 Production</div>
                    <div className="text-xs text-muted-foreground">
                      Live deployment
                    </div>
                  </div>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="preview"
                  id="preview"
                  className="peer sr-only"
                  data-testid="radio-preview"
                />
                <Label
                  htmlFor="preview"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover-elevate peer-data-[state=checked]:border-primary cursor-pointer"
                >
                  <div className="text-center">
                    <div className="mb-1 text-sm font-semibold">🔍 Preview</div>
                    <div className="text-xs text-muted-foreground">
                      Test deployment
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Branch */}
          <div className="space-y-2">
            <Label htmlFor="branch">Branch</Label>
            <Input
              id="branch"
              placeholder="main"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              data-testid="input-branch"
            />
            <p className="text-xs text-muted-foreground">
              The Git branch to deploy (default: main)
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              disabled={createMutation.isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createMutation.isPending ||
                !projectId ||
                !subdomain ||
                !!subdomainError ||
                projects.length === 0
              }
              data-testid="button-deploy"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Deploy
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
