import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Eye, EyeOff, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, environment } from "@/config/app.config";

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

// Get default env from configuration - no hardcoded values
const getDefaultEnv = (): EnvVar[] => [
  { key: "VITE_API_URL", value: api.baseURL || window.location.origin, isSecret: false },
  { key: "NODE_ENV", value: environment.isDevelopment ? "development" : "production", isSecret: false },
];

export function EnvBrowser({ isOpen, onClose, envVars }: EnvBrowserProps) {
  const defaultEnv = getDefaultEnv();
  const displayEnvVars = envVars || defaultEnv;
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
      <DialogContent className="max-w-md bg-gradient-to-br from-amber-50 to-white dark:from-slate-900 dark:to-slate-800 border-2 border-amber-300 dark:border-amber-700/50" data-testid="env-browser-modal">
        <DialogHeader className="relative pb-2 border-b-2 border-amber-300 dark:border-amber-700/30">
          <DialogTitle className="flex items-center gap-3 text-lg font-bold text-amber-900 dark:text-amber-100">
            <span>⚙️ Environment Variables</span>
            <Badge variant="secondary" className="ml-auto text-xs bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
              {displayEnvVars.length} vars
            </Badge>
          </DialogTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
            data-testid="button-close-env-browser"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {displayEnvVars.map((env) => (
            <div
              key={env.key}
              className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-200 dark:border-amber-700/40 bg-white dark:bg-slate-800/80 hover:bg-amber-50 dark:hover:bg-slate-700/80 transition-colors"
              data-testid={`env-var-${env.key}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs font-bold text-amber-900 dark:text-amber-100 truncate">
                  {env.key}
                </div>
                <div className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  {env.isSecret && !visibleSecrets.has(env.key) ? "••••••••" : env.value}
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                {env.isSecret && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    onClick={() => toggleSecret(env.key)}
                    data-testid={`button-toggle-secret-${env.key}`}
                  >
                    {visibleSecrets.has(env.key) ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  onClick={() => copyToClipboard(env.key, env.value)}
                  data-testid={`button-copy-env-${env.key}`}
                >
                  {copied === env.key ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-4 border-t-2 border-amber-300 dark:border-amber-700/30">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="flex-1 border-2 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-semibold"
            data-testid="button-close-env"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
