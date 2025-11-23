import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";

interface Incident {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved';
  description: string;
  createdAt: string;
  resolvedAt?: string;
  affectedComponent?: string;
}

export default function IncidentDashboard() {
  const { data: incidents, isLoading, refetch } = useQuery<Incident[]>({
    queryKey: ['/api/incidents'],
    refetchInterval: 30000,
  });

  const openIncidents = incidents?.filter(i => i.status === 'open') || [];
  const resolvedIncidents = incidents?.filter(i => i.status === 'resolved') || [];

  const severityConfig = {
    low: { color: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800', label: 'Low', badge: 'default' },
    medium: { color: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800', label: 'Medium', badge: 'secondary' },
    high: { color: 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800', label: 'High', badge: 'destructive' },
    critical: { color: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800', label: 'Critical', badge: 'destructive' },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading incidents...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
              Incident Dashboard
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor platform health incidents and resolution status
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="gap-2"
            data-testid="button-refresh-incidents"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{openIncidents.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{resolvedIncidents.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{incidents?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Open Incidents Section */}
        {openIncidents.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Open Incidents
            </h3>
            <div className="space-y-3">
              {openIncidents.map((incident) => {
                const config = severityConfig[incident.severity];
                return (
                  <Card key={incident.id} className={`border ${config.color}`} data-testid={`incident-card-${incident.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-sm font-semibold">{incident.type}</CardTitle>
                          <CardDescription className="mt-1">{incident.description}</CardDescription>
                        </div>
                        <Badge variant="destructive">{config.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        {incident.affectedComponent && (
                          <span>Component: <code className="bg-background px-1 rounded">{incident.affectedComponent}</code></span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(incident.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Resolved Incidents Section */}
        {resolvedIncidents.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Resolved Incidents
            </h3>
            <div className="space-y-2">
              {resolvedIncidents.slice(0, 5).map((incident) => (
                <Card key={incident.id} className="opacity-60 hover:opacity-100 transition-opacity" data-testid={`incident-resolved-${incident.id}`}>
                  <CardContent className="pt-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{incident.type}</span>
                      <span className="text-xs text-muted-foreground">
                        Resolved {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {incidents?.length === 0 && (
          <Card className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No incidents detected. Platform is healthy!</p>
          </Card>
        )}
      </div>
    </div>
  );
}
