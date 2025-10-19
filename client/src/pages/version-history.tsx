import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { History, RotateCcw, Save, Calendar } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ProjectVersion } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface VersionHistoryProps {
  projectId: string;
}

export default function VersionHistory({ projectId }: VersionHistoryProps) {
  const { toast } = useToast();
  const [saveLabel, setSaveLabel] = useState("");
  const [saveDescription, setSaveDescription] = useState("");

  // Fetch versions
  const { data: versions = [], isLoading } = useQuery<ProjectVersion[]>({
    queryKey: ["/api/projects", projectId, "versions"],
  });

  // Save version mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label: saveLabel, description: saveDescription }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw error;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "versions"] });
      toast({
        title: "Version Saved!",
        description: "Project snapshot created successfully",
      });
      setSaveLabel("");
      setSaveDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save version",
        variant: "destructive",
      });
    },
  });

  // Restore version mutation
  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await fetch(`/api/projects/${projectId}/versions/${versionId}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw error;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "Version Restored!",
        description: "Project restored to selected version",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Restore Failed",
        description: error.message || "Failed to restore version",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!saveLabel.trim()) {
      toast({
        title: "Label Required",
        description: "Please enter a version label",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const handleRestore = (versionId: string) => {
    if (confirm("Are you sure you want to restore this version? Current files will be replaced.")) {
      restoreMutation.mutate(versionId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading version history...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <History className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Version History</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Save snapshots of your project and restore previous versions
        </p>
      </div>

      {/* Save New Version */}
      <Card className="mb-6" data-testid="card-save-version">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Current Version
          </CardTitle>
          <CardDescription>Create a snapshot of your project's current state</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Version Label*</label>
            <Input
              placeholder="e.g., Before adding auth"
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              data-testid="input-version-label"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description (optional)</label>
            <Textarea
              placeholder="What changed in this version?"
              value={saveDescription}
              onChange={(e) => setSaveDescription(e.target.value)}
              rows={3}
              data-testid="textarea-version-description"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-version"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Version"}
          </Button>
        </CardFooter>
      </Card>

      {/* Version List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Saved Versions</h3>
        
        {versions.length === 0 ? (
          <Card data-testid="card-no-versions">
            <CardContent className="py-12 text-center">
              <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No versions saved yet</p>
            </CardContent>
          </Card>
        ) : (
          versions.map((version) => (
            <Card key={version.id} data-testid={`card-version-${version.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{version.label}</CardTitle>
                    {version.description && (
                      <CardDescription className="mt-1">{version.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                  </Badge>
                </div>
              </CardHeader>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() => handleRestore(version.id)}
                  disabled={restoreMutation.isPending}
                  data-testid={`button-restore-${version.id}`}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore This Version
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
