import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { 
  Database, 
  Play, 
  RotateCcw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  FileCode 
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ProjectMigration } from "@shared/schema";

interface MigrationsPanelProps {
  projectId: string;
}

function MigrationStatusBadge({ status }: { status: string }) {
  if (status === "applied") {
    return (
      <Badge variant="outline" className="border-green-500/30 text-green-600
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Applied
      </Badge>
    );
  }
  
  if (status === "failed") {
    return (
      <Badge variant="outline" className="border-red-500/30 text-red-600
        <XCircle className="w-3 h-3 mr-1" />
        Failed
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="border-yellow-500/30 text-yellow-600
      <Clock className="w-3 h-3 mr-1" />
      Pending
    </Badge>
  );
}

function MigrationCard({ migration }: { migration: ProjectMigration }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="hover-elevate" data-testid={`card-migration-${migration.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <CardTitle className="text-sm font-semibold truncate" data-testid={`text-migration-name-${migration.id}`}>
                {migration.name}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono truncate">{migration.filename}</span>
              <span>•</span>
              <span>{new Date(migration.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <MigrationStatusBadge status={migration.status} />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              data-testid={`button-toggle-sql-${migration.id}`}
            >
              {isOpen ? (
                <ChevronDown className="w-4 h-4 mr-2" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-2" />
              )}
              <FileCode className="w-4 h-4 mr-2" />
              View SQL
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="border rounded-md bg-muted/30 overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/50">
                <span className="text-xs font-semibold text-muted-foreground">Migration SQL</span>
              </div>
              <ScrollArea className="max-h-[300px]">
                <pre className="p-3 text-xs font-mono" data-testid={`text-sql-${migration.id}`}>
                  <code>{migration.sql}</code>
                </pre>
              </ScrollArea>
              
              {migration.rollbackSql && (
                <>
                  <div className="px-3 py-2 border-t bg-muted/50">
                    <span className="text-xs font-semibold text-muted-foreground">Rollback SQL</span>
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    <pre className="p-3 text-xs font-mono" data-testid={`text-rollback-sql-${migration.id}`}>
                      <code>{migration.rollbackSql}</code>
                    </pre>
                  </ScrollArea>
                </>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex items-center gap-2">
          {migration.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled
              data-testid={`button-apply-${migration.id}`}
            >
              <Play className="w-3 h-3 mr-2" />
              Apply (Coming Soon)
            </Button>
          )}
          
          {migration.status === "applied" && (
            <>
              <div className="flex-1 text-xs text-muted-foreground">
                Applied: {migration.appliedAt ? new Date(migration.appliedAt).toLocaleString() : "N/A"}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled
                data-testid={`button-rollback-${migration.id}`}
              >
                <RotateCcw className="w-3 h-3 mr-2" />
                Rollback (Coming Soon)
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MigrationsPanel({ projectId }: MigrationsPanelProps) {
  const { data: migrations = [], isLoading } = useQuery<ProjectMigration[]>({
    queryKey: ["/api/projects", projectId, "migrations"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/migrations`);
      if (!response.ok) {
        throw new Error("Failed to fetch migrations");
      }
      return response.json();
    },
  });

  const pendingCount = migrations.filter(m => m.status === "pending").length;
  const appliedCount = migrations.filter(m => m.status === "applied").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center space-y-3">
          <Database className="w-12 h-12 mx-auto text-muted-foreground animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading migrations...</p>
        </div>
      </div>
    );
  }

  if (migrations.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center space-y-3 max-w-md">
          <Database className="w-12 h-12 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">No Migrations Yet</h3>
          <p className="text-sm text-muted-foreground">
            Database migrations will appear here once you make changes to your schema.
            Migration generation is coming soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="migrations-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Database className="w-5 h-5" />
            Database Migrations
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {appliedCount} applied • {pendingCount} pending
          </p>
        </div>
        
        <Button variant="outline" disabled data-testid="button-generate-migration">
          <Database className="w-4 h-4 mr-2" />
          Generate Migration (Coming Soon)
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-3">
          {migrations.map((migration) => (
            <MigrationCard key={migration.id} migration={migration} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
