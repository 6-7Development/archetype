import { Package, Plus, Trash2, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface Dependency {
  name: string;
  version: string;
  latest?: string;
  dev: boolean;
}

export function PackageManager() {
  const [packages, setPackages] = useState<Dependency[]>([
    { name: 'react', version: '18.2.0', latest: '18.3.1', dev: false },
    { name: 'typescript', version: '5.3.3', latest: '5.4.0', dev: true },
    { name: '@tanstack/react-query', version: '5.0.0', latest: '5.28.0', dev: false },
  ]);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4" />
          <h3 className="font-semibold">npm Packages</h3>
        </div>
        <Button size="sm" data-testid="button-add-package">
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>

      <Input
        placeholder="Search packages..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-3 h-8 text-xs"
      />

      <div className="flex-1 overflow-y-auto space-y-2">
        {packages.map((pkg) => (
          <Card key={pkg.name} className="p-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs font-mono font-semibold">{pkg.name}</code>
                <Badge variant="outline" className="text-xs">
                  v{pkg.version}
                </Badge>
                {pkg.dev && <Badge variant="secondary" className="text-xs">dev</Badge>}
                {pkg.latest && pkg.latest !== pkg.version && (
                  <Badge variant="outline" className="text-xs text-yellow-600">
                    v{pkg.latest} available
                  </Badge>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-6">
              <Download className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-destructive">
              <Trash2 className="w-3 h-3" />
            </Button>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-3 bg-muted/50">
        <p className="text-xs text-muted-foreground">
          npm install in terminal to update packages or edit package.json directly
        </p>
      </Card>
    </div>
  );
}
