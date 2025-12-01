import { Key, Plus, Trash2, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}

interface EnvironmentEditorProps {
  refreshKey?: number;
}

export function EnvironmentEditor({ refreshKey = 0 }: EnvironmentEditorProps) {
  const [vars, setVars] = useState<EnvVar[]>([
    { key: 'DATABASE_URL', value: '••••••••', isSecret: true },
    { key: 'API_KEY', value: '••••••••', isSecret: true },
    { key: 'DEBUG', value: 'true', isSecret: false },
  ]);
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleShowValue = (key: string) => {
    const newShow = new Set(showValues);
    if (newShow.has(key)) {
      newShow.delete(key);
    } else {
      newShow.add(key);
    }
    setShowValues(newShow);
  };

  const copyToClipboard = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    toast({
      title: 'Copied',
      description: `${key} copied to clipboard`,
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4" />
          <h3 className="font-semibold">Environment Variables</h3>
        </div>
        <Button size="sm" data-testid="button-add-env-var">
          <Plus className="w-3 h-3 mr-1" />
          Add Variable
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {vars.map((envVar) => (
          <Card key={envVar.key} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono font-semibold">{envVar.key}</code>
                {envVar.isSecret && <Badge variant="secondary" className="text-xs">Secret</Badge>}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono flex items-center gap-2">
                {showValues.has(envVar.key) ? envVar.value : '••••••••'}
                {envVar.isSecret && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0"
                    onClick={() => toggleShowValue(envVar.key)}
                  >
                    {showValues.has(envVar.key) ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => copyToClipboard(envVar.value, envVar.key)}
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-destructive">
              <Trash2 className="w-3 h-3" />
            </Button>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-3 bg-muted/50">
        <p className="text-xs text-muted-foreground">
          Secrets are encrypted and never shown in the UI. Create secrets in the Replit dashboard.
        </p>
      </Card>
    </div>
  );
}
