import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Sparkles,
  ShoppingCart,
  Globe,
  Briefcase,
  Gamepad2,
  Layout,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Template = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  previewUrl?: string;
  metadata?: {
    tags?: string[];
    difficulty?: string;
  };
};

const categoryIcons: Record<string, any> = {
  'ecommerce': ShoppingCart,
  'website': Globe,
  'saas': Briefcase,
  'game': Gamepad2,
  'landing': Layout,
};

const categoryLabels: Record<string, string> = {
  'all': 'All Templates',
  'ecommerce': 'E-Commerce',
  'website': 'Websites',
  'saas': 'SaaS Apps',
  'game': 'Games',
  'landing': 'Landing Pages',
};

interface TemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateGallery({ open, onOpenChange }: TemplateGalleryProps) {
  const [, setLocation] = useLocation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset state when modal closes to ensure it can reopen properly
  useEffect(() => {
    if (!open) {
      setActiveCategory('all');
      setSearchQuery('');
    }
  }, [open]);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ['/api/templates'],
    enabled: open,
  });

  // Memoize categories to avoid recreating on every render
  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(templates.map(t => t.category)))];
  }, [templates]);

  // Validate activeCategory is valid when templates change
  useEffect(() => {
    if (templates.length > 0 && !categories.includes(activeCategory)) {
      setActiveCategory('all');
    }
  }, [templates, activeCategory, categories]);

  const cloneTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest('POST', `/api/templates/${templateId}/instantiate`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Template cloned!",
        description: "Your new project has been created from the template.",
      });
      onOpenChange(false);
      setLocation(`/builder/${data.projectId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to clone template",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Template Gallery
          </DialogTitle>
          <DialogDescription>
            Start your project with a professional template
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-templates"
            />
          </div>

          {/* Category Tabs */}
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {categories.map((category) => {
                const Icon = categoryIcons[category] || Layout;
                return (
                  <TabsTrigger 
                    key={category} 
                    value={category}
                    className="flex items-center gap-2"
                    data-testid={`tab-category-${category}`}
                  >
                    <Icon className="w-4 h-4" />
                    {categoryLabels[category] || category}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={activeCategory} className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No templates found matching your search' : 'No templates available'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[45vh] overflow-y-auto pr-2">
                  {filteredTemplates.map((template) => {
                    const Icon = categoryIcons[template.category] || Layout;
                    return (
                      <Card 
                        key={template.id} 
                        className="hover-elevate active-elevate-2 transition-all"
                        data-testid={`card-template-${template.slug}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base truncate">{template.name}</CardTitle>
                              <CardDescription className="line-clamp-2 mt-1 text-xs">
                                {template.description}
                              </CardDescription>
                            </div>
                            <Icon className="w-5 h-5 text-primary shrink-0" />
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between">
                            <div className="flex gap-1 flex-wrap">
                              {template.metadata?.tags?.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => cloneTemplate.mutate(template.id)}
                              disabled={cloneTemplate.isPending}
                              data-testid={`button-use-template-${template.slug}`}
                            >
                              {cloneTemplate.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                'Use Template'
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
