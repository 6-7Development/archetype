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
  
  const currentModel = (prefs as any)?.aiModel || "claude";
  
  return (
    <Select
      value={currentModel}
      onValueChange={(model) => updateMutation.mutate(model)}
      data-testid="select-ai-model"
    >
      <SelectTrigger className="w-56">
        <div className="flex items-center gap-2">
          {currentModel === 'gemini' ? (
            <Zap className="h-3 w-3" />
          ) : (
            <Brain className="h-3 w-3" />
          )}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="claude" data-testid="option-claude">
          Claude Sonnet 4 ($3/$15)
        </SelectItem>
        <SelectItem value="gemini" data-testid="option-gemini">
          Gemini 2.5 Flash ($0.075/$0.30)
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
