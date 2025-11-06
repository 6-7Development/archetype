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
  
  return (
    <div className="flex items-center gap-2">
      <Brain className="h-4 w-4 text-muted-foreground" />
      <Select
        value={prefs?.preferences?.aiModel || "claude"}
        onValueChange={(model) => updateMutation.mutate(model)}
        data-testid="select-ai-model"
      >
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="claude" data-testid="option-claude">
            <div className="flex items-center gap-2">
              <Brain className="h-3 w-3" />
              <span>Claude Sonnet 4</span>
              <span className="text-xs text-muted-foreground">($3/$15)</span>
            </div>
          </SelectItem>
          <SelectItem value="gemini" data-testid="option-gemini">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3" />
              <span>Gemini 2.5 Flash</span>
              <span className="text-xs text-muted-foreground">($0.075/$0.30)</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
