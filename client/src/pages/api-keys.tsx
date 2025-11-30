import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Key, Plus, Trash2, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface APIKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface UsageStats {
  subscription: {
    plan: string;
  } | null;
  plan: string;
}

export default function APIKeysPage() {
  const { toast } = useToast();
  const [keyName, setKeyName] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const { data: stats } = useQuery<UsageStats>({
    queryKey: ["/api/usage/stats"],
  });

  const { data: apiKeys, isLoading } = useQuery<APIKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const createKey = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/api-keys", { name });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setNewKey(data.apiKey); // Full key only shown once
      setKeyName("");
      toast({
        title: "API key created",
        description: "Your API key has been created. Make sure to copy it now - you won't be able to see it again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest("DELETE", `/api/api-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "API key deleted",
        description: "The API key has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete API key",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const userPlan = stats?.plan || 'free';
  const hasProAccess = ['pro', 'business', 'enterprise'].includes(userPlan);

  // Close dialog when new key is dismissed
  const handleCloseNewKeyDialog = () => {
    setNewKey(null);
    setShowCreateDialog(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6" data-testid="page-api-keys">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-api-keys-title">API Keys</h1>
            <p className="text-muted-foreground">
              Manage your API keys for programmatic access
            </p>
          </div>
          {hasProAccess && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-api-key">
                  <Plus className="w-4 h-4 mr-2" />
                  Create API Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Create a new API key for programmatic access
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Key Name</Label>
                    <Input
                      id="key-name"
                      placeholder="Production Server"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      data-testid="input-key-name"
                    />
                    <p className="text-xs text-muted-foreground">
                      A descriptive name to identify this key
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createKey.mutate(keyName)}
                    disabled={!keyName.trim() || createKey.isPending}
                    data-testid="button-create-key-submit"
                  >
                    {createKey.isPending ? "Creating..." : "Create Key"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* New Key Display Dialog */}
        {newKey && (
          <Dialog open={!!newKey} onOpenChange={handleCloseNewKeyDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Your New API Key</DialogTitle>
                <DialogDescription>
                  Make sure to copy your API key now. You won't be able to see it again!
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This is the only time you'll see this key. Store it securely.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newKey}
                      readOnly
                      className="font-mono text-sm"
                      data-testid="input-new-api-key"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(newKey)}
                      data-testid="button-copy-new-key"
                    >
                      {copiedKey ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseNewKeyDialog} data-testid="button-close-new-key">
                  I've copied my key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Pro Plan Required */}
        {!hasProAccess && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                Pro Plan Required
              </CardTitle>
              <CardDescription>
                API keys are available for Pro, Business, and Enterprise plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Upgrade your plan to create and manage API keys for programmatic access to Lomu.
              </p>
              <Button data-testid="button-upgrade-for-api-keys">
                Upgrade to Pro
              </Button>
            </CardContent>
          </Card>
        )}

        {/* API Keys List */}
        {hasProAccess && (
          <Card>
            <CardHeader>
              <CardTitle>Your API Keys</CardTitle>
              <CardDescription>
                Manage your API keys for programmatic access
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : apiKeys && apiKeys.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id} data-testid={`api-key-row-${key.id}`}>
                        <TableCell className="font-medium" data-testid={`api-key-name-${key.id}`}>
                          {key.name}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs font-mono bg-muted px-2 py-1 rounded" data-testid={`api-key-prefix-${key.id}`}>
                            {key.keyPrefix}••••••••
                          </code>
                        </TableCell>
                        <TableCell data-testid={`api-key-last-used-${key.id}`}>
                          {key.lastUsedAt 
                            ? new Date(key.lastUsedAt).toLocaleDateString()
                            : <Badge variant="secondary">Never</Badge>
                          }
                        </TableCell>
                        <TableCell data-testid={`api-key-created-${key.id}`}>
                          {new Date(key.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteKey.mutate(key.id)}
                            data-testid={`button-delete-key-${key.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8" data-testid="text-no-api-keys">
                  <Key className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first API key to get started
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Documentation */}
        {hasProAccess && (
          <Card>
            <CardHeader>
              <CardTitle>API Documentation</CardTitle>
              <CardDescription>
                Learn how to use your API keys
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Authentication</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Include your API key in the Authorization header:
                </p>
                <pre className="bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto">
                  {`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.beehive.dev/v1/generate`}
                </pre>
              </div>
              <div>
                <h4 className="font-medium mb-2">Rate Limits</h4>
                <p className="text-sm text-muted-foreground">
                  Pro: 100 requests/minute • Business: 500 requests/minute • Enterprise: Unlimited
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
