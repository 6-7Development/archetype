import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SchemaDriftMetrics {
  timestamp: string;
  status: 'healthy' | 'error' | 'degraded';
  errorCount: number;
  details: {
    missingTables: string[];
    missingColumns: Array<{ table: string; column: string; expected: string }>;
    rlsDisabled: string[];
    insufficientPolicies: Array<{ table: string; expected: number; actual: number }>;
  };
}

interface RLSPolicies {
  timestamp: string;
  totalPolicies: number;
  tables: number;
  byTable: Record<string, Array<{ name: string; permissive: boolean; roles: string[] }>>;
}

interface SystemHealth {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'error';
  components: {
    database: string;
    schema: string;
    rateLimiter: string;
    backgroundJobs: string;
    rls: string;
  };
  errors: number;
}

export default function MonitoringPage() {
  const { data: driftData, isLoading: driftLoading } = useQuery<SchemaDriftMetrics>({
    queryKey: ['/api/monitoring/schema-drift'],
  });

  const { data: rlsData, isLoading: rlsLoading } = useQuery<RLSPolicies>({
    queryKey: ['/api/monitoring/rls-policies'],
  });

  const { data: healthData, isLoading: healthLoading } = useQuery<SystemHealth>({
    queryKey: ['/api/monitoring/system-health'],
  });

  const statusColor = {
    healthy: 'bg-green-500/10 text-green-700 border-green-200',
    degraded: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
    error: 'bg-red-500/10 text-red-700 border-red-200',
  };

  const statusIcon = {
    healthy: <CheckCircle className="w-5 h-5" />,
    degraded: <AlertCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time health, RLS policies, and schema drift detection</p>
      </div>

      {/* Overall Health Status */}
      {healthData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {statusIcon[healthData.status]}
              System Health
            </CardTitle>
            <CardDescription>{new Date(healthData.timestamp).toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(healthData.components).map(([component, status]) => (
                <div key={component} className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 capitalize">{component.replace(/([A-Z])/g, ' $1')}</p>
                  <Badge variant={status === 'connected' || status === 'active' ? 'default' : 'destructive'}>
                    {status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schema Drift Detection */}
      {driftData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {statusIcon[driftData.status]}
              Schema Drift Detection
            </CardTitle>
            <CardDescription>
              {driftData.errorCount === 0 ? 'All systems nominal' : `${driftData.errorCount} issues detected`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600">Missing Tables</p>
                <p className="text-2xl font-bold">{driftData.details.missingTables.length}</p>
              </div>
              <div className="space-y-1 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600">Missing Columns</p>
                <p className="text-2xl font-bold">{driftData.details.missingColumns.length}</p>
              </div>
              <div className="space-y-1 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600">RLS Disabled</p>
                <p className="text-2xl font-bold">{driftData.details.rlsDisabled.length}</p>
              </div>
              <div className="space-y-1 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600">Insufficient Policies</p>
                <p className="text-2xl font-bold">{driftData.details.insufficientPolicies.length}</p>
              </div>
            </div>

            {driftData.details.insufficientPolicies.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">Policy Issues:</p>
                <ul className="mt-2 space-y-1">
                  {driftData.details.insufficientPolicies.map((p, i) => (
                    <li key={i} className="text-sm text-yellow-700">
                      • {p.table}: {p.actual}/{p.expected} policies
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* RLS Policies Overview */}
      {rlsData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              RLS Policies
            </CardTitle>
            <CardDescription>
              {rlsData.totalPolicies} policies across {rlsData.tables} tables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(rlsData.byTable)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([table, policies]) => (
                  <div key={table} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{table}</p>
                      <Badge variant="outline">{policies.length} policies</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {policies.map((policy, i) => (
                        <div key={i} className="text-xs p-2 bg-gray-50 rounded border border-gray-200">
                          <p className="font-mono truncate">{policy.name}</p>
                          <p className="text-gray-600 mt-1">{policy.permissive ? 'Permissive' : 'Restrictive'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
