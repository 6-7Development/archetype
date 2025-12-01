/**
 * AI Model Selector Component
 * 
 * Dropdown for selecting AI model for chat interactions
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Zap, Brain, Crown } from "lucide-react";

interface AIModel {
  id: string;
  provider: 'google';
  displayName: string;
  description: string;
  contextWindow: number;
  supportsVision: boolean;
  costPer1MTokens: { input: number; output: number };
  speedRating: number;
  qualityRating: number;
  isPremium: boolean;
  isDefault: boolean;
}

interface ModelsResponse {
  success: boolean;
  models: AIModel[];
  defaultModelId: string;
  providers: {
    google: boolean;
  };
}

interface AIModelSelectorProps {
  value?: string;
  onChange?: (modelId: string) => void;
  compact?: boolean;
  disabled?: boolean;
}

const PROVIDER_ICONS = {
  google: '🐝',
};

const PROVIDER_LABELS = {
  google: 'Google Gemini',
};

export function AIModelSelector({ value, onChange, compact = false, disabled = false }: AIModelSelectorProps) {
  const { data, isLoading, error } = useQuery<ModelsResponse>({
    queryKey: ['/api/models'],
    staleTime: 60 * 1000, // 1 minute
  });
  
  const updateMutation = useMutation({
    mutationFn: async (aiModel: string) => {
      return apiRequest("PUT", "/api/user/preferences", { preferredAiModel: aiModel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    },
  });

  const handleChange = (modelId: string) => {
    if (onChange) {
      onChange(modelId);
    }
    updateMutation.mutate(modelId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10" data-testid="beehive-model-badge">
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        <span className="text-sm font-medium">Loading...</span>
      </div>
    );
  }

  if (error || !data?.models || data.models.length === 0) {
    // Fallback to simple badge when no models available
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10" data-testid="beehive-model-badge">
        <Zap className="h-3 w-3 text-primary" />
        <span className="text-sm font-medium">Scout AI</span>
      </div>
    );
  }

  const selectedModel = data.models.find(m => m.id === value) || data.models.find(m => m.isDefault) || data.models[0];
  
  // Group models by provider
  const modelsByProvider = data.models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, AIModel[]>);

  const formatCost = (model: AIModel) => {
    const avgCost = (model.costPer1MTokens.input + model.costPer1MTokens.output) / 2;
    if (avgCost < 1) return `$${avgCost.toFixed(2)}`;
    return `$${avgCost.toFixed(0)}`;
  };

  const getSpeedIcon = (rating: number) => {
    if (rating >= 8) return <Zap className="h-3 w-3 text-green-500" />;
    if (rating >= 5) return <Zap className="h-3 w-3 text-yellow-500" />;
    return <Zap className="h-3 w-3 text-muted-foreground" />;
  };

  const getQualityIcon = (rating: number) => {
    if (rating >= 8) return <Brain className="h-3 w-3 text-purple-500" />;
    if (rating >= 5) return <Brain className="h-3 w-3 text-blue-500" />;
    return <Brain className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <Select value={value || selectedModel?.id} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger 
        className={compact ? "w-[180px] h-8" : "w-[280px]"} 
        data-testid="select-ai-model"
      >
        <SelectValue placeholder="Select AI model">
          {selectedModel && (
            <div className="flex items-center gap-2">
              <span>{PROVIDER_ICONS[selectedModel.provider]}</span>
              <span className="truncate">{selectedModel.displayName}</span>
              {selectedModel.isPremium && <Crown className="h-3 w-3 text-honey shrink-0" />}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent data-testid="select-ai-model-content">
        {Object.entries(modelsByProvider).map(([provider, models]) => (
          <SelectGroup key={provider}>
            <SelectLabel className="flex items-center gap-2">
              {PROVIDER_ICONS[provider as keyof typeof PROVIDER_ICONS]}
              {PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS]}
              {!data.providers[provider as keyof typeof data.providers] && (
                <Badge variant="outline" className="text-xs ml-2">No API Key</Badge>
              )}
            </SelectLabel>
            {models.map((model) => (
              <SelectItem 
                key={model.id} 
                value={model.id}
                disabled={!data.providers[model.provider]}
                data-testid={`select-model-${model.id}`}
              >
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.displayName}</span>
                    {model.isPremium && (
                      <Crown className="h-3 w-3 text-honey" />
                    )}
                    {model.isDefault && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1">
                          {getSpeedIcon(model.speedRating)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Speed: {model.speedRating}/10</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1">
                          {getQualityIcon(model.qualityRating)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Quality: {model.qualityRating}/10</TooltipContent>
                    </Tooltip>
                    <span>{formatCost(model)}/1M</span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
