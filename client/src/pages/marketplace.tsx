import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ShoppingCart, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Template, TemplatePurchase } from "@shared/schema";

export default function Marketplace() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Check for purchase success from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchaseStatus = params.get('purchase');
    
    if (purchaseStatus === 'success') {
      toast({
        title: "Purchase Successful!",
        description: "Template has been added to your library",
      });
      
      // Clean up URL
      window.history.replaceState({}, '', '/marketplace');
    }
  }, [toast]);

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  // Fetch user's purchases
  const { data: purchases = [], isLoading: purchasesLoading } = useQuery<TemplatePurchase[]>({
    queryKey: ["/api/templates/my-purchases"],
  });

  // Stripe checkout mutation for template purchase
  const checkoutMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch("/api/create-template-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ templateId }), // Only send ID - server fetches authoritative price
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create checkout session");
      }
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      // Redirect to Stripe checkout
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Failed",
        description: error.message || "Failed to initiate payment",
        variant: "destructive",
      });
      setSelectedTemplate(null);
    },
  });

  // Check if user owns template
  const hasPurchased = (templateId: string) => {
    return purchases.some((p) => p.templateId === templateId);
  };

  // Instantiate template mutation
  const instantiateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/templates/${templateId}/instantiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: null, description: null }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw error;
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Created!",
        description: "Template instantiated successfully",
      });
      // Redirect to builder with new project
      window.location.href = `/builder?projectId=${data.projectId}`;
    },
    onError: (error: any) => {
      if (error.requiresPurchase) {
        toast({
          title: "Premium Template",
          description: "Please purchase this template first",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create project",
          variant: "destructive",
        });
      }
    },
  });

  const handlePurchase = (templateId: string) => {
    setSelectedTemplate(templateId);
    checkoutMutation.mutate(templateId); // Only send ID - server fetches authoritative price
  };

  const handleUseTemplate = (templateId: string) => {
    instantiateMutation.mutate(templateId);
  };

  if (templatesLoading || purchasesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ShoppingCart className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Template Marketplace</h1>
        </div>
        <p className="text-muted-foreground">
          Browse and purchase premium templates to jumpstart your projects
        </p>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => {
          const isPremium = template.isPremium && Number(template.price) > 0;
          const owned = hasPurchased(template.id);
          const price = Number(template.price);

          return (
            <Card key={template.id} className="flex flex-col" data-testid={`card-template-${template.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <CardTitle className="line-clamp-2">{template.name}</CardTitle>
                  {isPremium && (
                    <Badge variant="default" className="shrink-0" data-testid={`badge-premium-${template.id}`}>
                      <Sparkles className="w-3 h-3 mr-1" />
                      ${price.toFixed(2)}
                    </Badge>
                  )}
                  {!isPremium && (
                    <Badge variant="secondary" className="shrink-0" data-testid={`badge-free-${template.id}`}>
                      Free
                    </Badge>
                  )}
                </div>
                <CardDescription className="line-clamp-3">
                  {template.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" data-testid={`badge-category-${template.id}`}>
                      {template.category}
                    </Badge>
                  </div>
                  {template.salesCount > 0 && (
                    <p className="text-xs text-muted-foreground" data-testid={`text-sales-${template.id}`}>
                      {template.salesCount} sales
                    </p>
                  )}
                  {owned && (
                    <div className="flex items-center gap-1 text-sm text-green-600" data-testid={`text-owned-${template.id}`}>
                      <Check className="w-4 h-4" />
                      <span>Owned</span>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex gap-2">
                {isPremium && !owned && (
                  <Button
                    onClick={() => handlePurchase(template.id)}
                    disabled={checkoutMutation.isPending && selectedTemplate === template.id}
                    className="flex-1"
                    data-testid={`button-purchase-${template.id}`}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {checkoutMutation.isPending && selectedTemplate === template.id
                      ? "Processing..."
                      : `Buy $${price.toFixed(2)}`}
                  </Button>
                )}
                {(!isPremium || owned) && (
                  <Button
                    onClick={() => handleUseTemplate(template.id)}
                    disabled={instantiateMutation.isPending}
                    className="flex-1"
                    data-testid={`button-use-${template.id}`}
                  >
                    Use Template
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">No templates available yet</p>
        </div>
      )}
    </div>
  );
}
