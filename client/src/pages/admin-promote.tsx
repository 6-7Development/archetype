import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield } from "lucide-react";

export default function AdminPromotePage() {
  const [secret, setSecret] = useState("");
  const { toast } = useToast();

  const promoteMutation = useMutation({
    mutationFn: async (adminSecret: string) => {
      return await apiRequest("POST", "/api/admin/promote", { adminSecret });
    },
    onSuccess: () => {
      // Invalidate user cache to refresh admin status
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      toast({
        title: "Success!",
        description: "You now have admin privileges. Redirecting...",
      });
      
      // Wait for cache to refresh before redirecting
      setTimeout(() => {
        window.location.href = "/admin";
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Failed",
        description: error.message || "Invalid admin secret",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (secret.trim()) {
      promoteMutation.mutate(secret);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold text-center">
            Admin Promotion
          </CardTitle>
          <CardDescription className="text-center">
            Enter the admin secret key to gain admin privileges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="secret" className="text-sm font-medium">
                Admin Secret Key
              </label>
              <Input
                id="secret"
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter secret key"
                data-testid="input-admin-secret"
                autoComplete="off"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={promoteMutation.isPending || !secret.trim()}
              data-testid="button-promote"
            >
              {promoteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Promote to Admin
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
