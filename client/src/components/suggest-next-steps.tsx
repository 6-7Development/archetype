/**
 * Suggest Next Steps Panel
 * 
 * AI-powered feature that analyzes the current project and recommends actions
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Sparkles, Bug, RefreshCw, TestTube, FileText, Zap, 
  ChevronDown, ChevronRight, Loader2, Check, X, 
  Lightbulb, ArrowRight, Brain
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Suggestion {
  id: string;
  category: 'feature' | 'bugfix' | 'refactor' | 'test' | 'documentation' | 'performance';
  title: string;
  description: string;
  priority: number;
  relatedFiles?: string[];
  reasoning?: string;
  codeSnippet?: string;
  confidence: number;
}

interface SuggestionsResponse {
  success: boolean;
  suggestions: Suggestion[];
  generatedAt: string;
  model: string;
}

const CATEGORY_CONFIG = {
  feature: { icon: Sparkles, color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  bugfix: { icon: Bug, color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  refactor: { icon: RefreshCw, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  test: { icon: TestTube, color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  documentation: { icon: FileText, color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  performance: { icon: Zap, color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
};

interface SuggestNextStepsProps {
  projectId?: string;
  onSuggestionAccept?: (suggestion: Suggestion) => void;
  compact?: boolean;
}

export function SuggestNextSteps({ projectId, onSuggestionAccept, compact = false }: SuggestNextStepsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch suggestions
  const { 
    data, 
    isLoading, 
    refetch, 
    isFetching 
  } = useQuery<SuggestionsResponse>({
    queryKey: ['/api/ai/suggest-next', projectId],
    queryFn: async () => {
      const response = await fetch('/api/ai/suggest-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      return response.json();
    },
    enabled: false, // Don't auto-fetch, require manual trigger
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Accept mutation
  const acceptMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      return apiRequest(`/api/ai/suggestions/${suggestionId}/accept`, {
        method: 'POST',
      });
    },
    onSuccess: (_, suggestionId) => {
      toast({
        title: 'Suggestion accepted',
        description: 'Added to your task queue',
        variant: 'success',
      });
      // Find and call onSuggestionAccept if provided
      const suggestion = data?.suggestions.find(s => s.id === suggestionId);
      if (suggestion && onSuggestionAccept) {
        onSuggestionAccept(suggestion);
      }
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      return apiRequest(`/api/ai/suggestions/${suggestionId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'User dismissed' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/suggest-next'] });
    },
  });

  const handleGenerateSuggestions = () => {
    refetch();
  };

  const renderSuggestion = (suggestion: Suggestion) => {
    const config = CATEGORY_CONFIG[suggestion.category] || CATEGORY_CONFIG.feature;
    const Icon = config.icon;
    const isExpanded = expandedId === suggestion.id;

    return (
      <Card 
        key={suggestion.id} 
        className="overflow-hidden border-l-4"
        style={{ borderLeftColor: `hsl(var(--${suggestion.category === 'feature' ? 'purple' : suggestion.category === 'bugfix' ? 'red' : 'blue'}-500))` }}
        data-testid={`suggestion-card-${suggestion.id}`}
      >
        <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : suggestion.id)}>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className={`p-2 rounded-md ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-sm">{suggestion.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      P{suggestion.priority}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {suggestion.confidence}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {suggestion.description}
                  </p>
                </div>
              </div>
              
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                className="bg-honey text-charcoal hover:bg-honey/90"
                onClick={() => acceptMutation.mutate(suggestion.id)}
                disabled={acceptMutation.isPending}
                data-testid={`button-accept-${suggestion.id}`}
              >
                <Check className="h-3 w-3 mr-1" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rejectMutation.mutate(suggestion.id)}
                disabled={rejectMutation.isPending}
                data-testid={`button-reject-${suggestion.id}`}
              >
                <X className="h-3 w-3 mr-1" />
                Dismiss
              </Button>
            </div>
          </div>

          <CollapsibleContent>
            <div className="px-4 pb-4 pt-0 space-y-3 border-t mt-2 pt-3">
              {/* Reasoning */}
              {suggestion.reasoning && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Why this suggestion?</h5>
                  <p className="text-sm">{suggestion.reasoning}</p>
                </div>
              )}
              
              {/* Related files */}
              {suggestion.relatedFiles && suggestion.relatedFiles.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Related files</h5>
                  <div className="flex flex-wrap gap-1">
                    {suggestion.relatedFiles.map((file, i) => (
                      <Badge key={i} variant="secondary" className="text-xs font-mono">
                        {file}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Code snippet */}
              {suggestion.codeSnippet && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Suggested code</h5>
                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                    <code>{suggestion.codeSnippet}</code>
                  </pre>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerateSuggestions}
        disabled={isFetching}
        className="gap-2"
        data-testid="button-suggest-next"
      >
        {isFetching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Lightbulb className="h-4 w-4 text-honey" />
        )}
        Suggest Next Steps
      </Button>
    );
  }

  return (
    <div className="space-y-4" data-testid="panel-suggest-next-steps">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-honey" />
          <h3 className="font-semibold">Suggested Next Steps</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateSuggestions}
          disabled={isFetching}
          data-testid="button-refresh-suggestions"
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">{data?.suggestions ? 'Refresh' : 'Analyze Project'}</span>
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-honey mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Analyzing your project...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !data?.suggestions && (
        <Card className="p-6 text-center">
          <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-medium mb-1">Get AI-powered suggestions</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Scout will analyze your project and suggest the next best actions
          </p>
          <Button onClick={handleGenerateSuggestions} className="bg-honey text-charcoal hover:bg-honey/90">
            <Sparkles className="h-4 w-4 mr-2" />
            Analyze Project
          </Button>
        </Card>
      )}

      {/* Suggestions list */}
      {data?.suggestions && data.suggestions.length > 0 && (
        <div className="space-y-3">
          {data.suggestions.map(renderSuggestion)}
          
          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center pt-2">
            Generated by {data.model} at {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* No suggestions found */}
      {data?.suggestions && data.suggestions.length === 0 && (
        <Card className="p-6 text-center">
          <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h4 className="font-medium mb-1">Looking good!</h4>
          <p className="text-sm text-muted-foreground">
            No immediate suggestions. Your project is in great shape!
          </p>
        </Card>
      )}
    </div>
  );
}

export default SuggestNextSteps;
