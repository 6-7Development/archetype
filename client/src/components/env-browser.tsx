import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

interface EnvVar {
  key: string;
  value: string;
  isSecret?: boolean;
}

interface EnvBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  envVars?: EnvVar[];
}

const DEFAULT_ENV: EnvVar[] = [
  { key: "VITE_API_URL", value: "http://localhost:5000", isSecret: false },
  { key: "DATABASE_URL", value: "postgres://...", isSecret: true },
  { key: "NODE_ENV", value: "development", isSecret: false },
  { key: "SESSION_SECRET", value: "***", isSecret: true },
];

export function EnvBrowser({ isOpen, onClose, envVars = DEFAULT_ENV }: EnvBrowserProps) {
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string>("");

  const toggleSecret = (key: string) => {
    const newVisible = new Set(visibleSecrets);
    if (newVisible.has(key)) {
      newVisible.delete(key);
    } else {
      newVisible.add(key);
    }
    setVisibleSecrets(newVisible);
  };

  const copyToClipboard = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="env-browser-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Environment Variables
            <Badge variant="outline" className="ml-auto text-xs">
              {envVars.length} vars
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {envVars.map((env) => (
            <div
              key={env.key}
              className="flex items-center gap-2 p-2 rounded border border-border bg-muted/30 text-sm"
              data-testid={`env-var-${env.key}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs font-semibold text-foreground truncate">
                  {env.key}
                </div>
                <div className="font-mono text-xs text-muted-foreground truncate">
                  {env.isSecret && !visibleSecrets.has(env.key) ? "••••••••" : env.value}
                </div>
              </div>

              <div className="flex gap-1 flex-shrink-0">
                {env.isSecret && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => toggleSecret(env.key)}
                    data-testid={`button-toggle-secret-${env.key}`}
                  >
                    {visibleSecrets.has(env.key) ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(env.key, env.value)}
                  data-testid={`button-copy-env-${env.key}`}
                >
                  {copied === env.key ? (
                    <Check className="w-3 h-3 text-green-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" onClick={onClose} className="w-full">
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
