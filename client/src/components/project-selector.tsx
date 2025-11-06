import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Folder } from "lucide-react";

export function ProjectSelector() {
  const { data: projects } = useQuery({
    queryKey: ["/api/projects"],
  });
  
  const { data: activeSession } = useQuery({
    queryKey: ["/api/user/active-project"],
  });
  
  const activateMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/projects/${projectId}/activate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to activate project");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/active-project"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lomu-ai/history"] });
    },
  });
  
  return (
    <div className="flex items-center gap-2">
      <Folder className="h-4 w-4 text-muted-foreground" />
      <Select
        value={activeSession?.activeProjectId}
        onValueChange={(projectId) => activateMutation.mutate(projectId)}
        data-testid="select-project"
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent>
          {projects?.projects?.map((p: any) => (
            <SelectItem key={p.id} value={p.id} data-testid={`option-project-${p.id}`}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
