import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, Trash2, Eye, EyeOff, Globe, Lock } from "lucide-react";

interface DeploymentSettingsProps {
  deploymentId: string;
}

export function DeploymentSettings({ deploymentId }: DeploymentSettingsProps) {
  const [showAddEnvVar, setShowAddEnvVar] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [showCustomDomain, setShowCustomDomain] = useState(false);
  const { toast } = useToast();

  const { data: envVars } = useQuery<{ keys: string[] }>({
    queryKey: [`/api/deployments/${deploymentId}/env-variables`],
  });

  const { data: deployment } = useQuery<{ customDomain?: string; sslStatus?: string }>({
    queryKey: [`/api/deployments/${deploymentId}`],
  });

  const addEnvVarMutation = useMutation({
    mutationFn: async (variables: Record<string, string>) => {
      return await apiRequest("POST", `/api/deployments/${deploymentId}/env-variables`, { variables });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deployments/${deploymentId}/env-variables`] });
      setShowAddEnvVar(false);
      setNewEnvKey("");
      setNewEnvValue("");
      toast({ title: "Environment variable added" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", description: error.message });
    }
  });

  const deleteEnvVarMutation = useMutation({
    mutationFn: async (key: string) => {
      return await apiRequest("DELETE", `/api/deployments/${deploymentId}/env-variables/${key}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deployments/${deploymentId}/env-variables`] });
      toast({ title: "Environment variable deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", description: error.message });
    }
  });

  const setCustomDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      return await apiRequest("POST", `/api/deployments/${deploymentId}/custom-domain`, { customDomain: domain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deployments/${deploymentId}`] });
      setShowCustomDomain(false);
      setCustomDomain("");
      toast({ title: "Custom domain configured" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", description: error.message });
    }
  });

  const removeCustomDomainMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/deployments/${deploymentId}/custom-domain`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deployments/${deploymentId}`] });
      toast({ title: "Custom domain removed" });
    }
  });

  const handleAddEnvVar = () => {
    if (!newEnvKey.trim() || !newEnvValue.trim()) {
      toast({ variant: "destructive", description: "Key and value are required" });
      return;
    }
    addEnvVarMutation.mutate({ [newEnvKey]: newEnvValue });
  };

  const handleSetCustomDomain = () => {
    if (!customDomain.trim()) {
      toast({ variant: "destructive", description: "Domain is required" });
      return;
    }
    setCustomDomainMutation.mutate(customDomain);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Environment Variables
              </CardTitle>
              <CardDescription>
                Securely store API keys and configuration values (encrypted at rest)
              </CardDescription>
            </div>
            <Dialog open={showAddEnvVar} onOpenChange={setShowAddEnvVar}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-env-var">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Variable
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Environment Variable</DialogTitle>
                  <DialogDescription>
                    Environment variables are encrypted and never exposed in logs
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="env-key">Key</Label>
                    <Input
                      id="env-key"
                      data-testid="input-env-key"
                      placeholder="API_KEY"
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <Label htmlFor="env-value">Value</Label>
                    <Input
                      id="env-value"
                      data-testid="input-env-value"
                      type="password"
                      placeholder="sk_test_..."
                      value={newEnvValue}
                      onChange={(e) => setNewEnvValue(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleAddEnvVar} 
                    disabled={addEnvVarMutation.isPending}
                    data-testid="button-save-env-var"
                    className="w-full"
                  >
                    {addEnvVarMutation.isPending ? "Adding..." : "Add Variable"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {envVars?.keys && envVars.keys.length > 0 ? (
            <div className="space-y-2">
              {envVars.keys.map((key: string) => (
                <div 
                  key={key} 
                  className="flex items-center justify-between p-3 rounded-md border"
                  data-testid={`env-var-${key}`}
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <code className="text-sm font-mono">{key}</code>
                    <Badge variant="secondary" className="text-xs">Encrypted</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteEnvVarMutation.mutate(key)}
                    disabled={deleteEnvVarMutation.isPending}
                    data-testid={`button-delete-env-${key}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No environment variables configured</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Custom Domain
              </CardTitle>
              <CardDescription>
                Deploy to your own domain (Business+ plan required)
              </CardDescription>
            </div>
            {!deployment?.customDomain && (
              <Dialog open={showCustomDomain} onOpenChange={setShowCustomDomain}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-custom-domain">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Domain
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Custom Domain</DialogTitle>
                    <DialogDescription>
                      Point your domain's DNS to our servers and we'll handle SSL automatically
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="custom-domain">Domain</Label>
                      <Input
                        id="custom-domain"
                        data-testid="input-custom-domain"
                        placeholder="example.com"
                        value={customDomain}
                        onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
                      />
                    </div>
                    <div className="rounded-md bg-muted p-3">
                      <p className="text-xs font-medium mb-2">DNS Configuration:</p>
                      <code className="text-xs block">
                        CNAME @ archetype-deployments.com
                      </code>
                    </div>
                    <Button 
                      onClick={handleSetCustomDomain} 
                      disabled={setCustomDomainMutation.isPending}
                      data-testid="button-save-custom-domain"
                      className="w-full"
                    >
                      {setCustomDomainMutation.isPending ? "Configuring..." : "Add Domain"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {deployment?.customDomain ? (
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div className="space-y-1">
                <p className="text-sm font-medium">{deployment.customDomain}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={deployment.sslStatus === 'active' ? 'default' : 'secondary'}>
                    SSL: {deployment.sslStatus || 'pending'}
                  </Badge>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeCustomDomainMutation.mutate()}
                disabled={removeCustomDomainMutation.isPending}
                data-testid="button-remove-custom-domain"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No custom domain configured</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
