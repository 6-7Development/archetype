import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Zap } from "lucide-react";

export function AIModelSelector() {
  const { data: prefs } = useQuery({
    queryKey: ["/api/user/preferences"],
  });
  
  const updateMutation = useMutation({
    mutationFn: async (aiModel: string) => {
      return apiRequest("PUT", "/api/user/preferences", { aiModel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    },
  });
  
  // Always use Hexad/Gemini for chat
  const currentModel = "gemini";
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10" data-testid="hexad-model-badge">
      <Zap className="h-3 w-3 text-primary" />
      <span className="text-sm font-medium">Hexad</span>
    </div>
  );
}
