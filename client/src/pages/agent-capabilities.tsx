import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Wrench, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Loader2,
  Database,
  Key,
  Brain,
  FileCode,
  Search,
  Globe,
  Eye,
  Terminal,
  Sparkles,
  Shield,
  Zap
} from 'lucide-react';
import { buildApiUrl } from '@/lib/api-utils';

interface ScoutTool {
  id: string;
  name: string;
  description: string;
  category: string;
  isAvailable: boolean;
  status: string;
  dependencies: string[];
  requiresAuth: boolean;
  requiresDatabase: boolean;
  requiresAIService: string | null;
}

interface AIService {
  id: string;
  name: string;
  provider: string;
  status: 'configured' | 'missing';
  isRequired: boolean;
}

interface RegistryData {
  tools: ScoutTool[];
  aiServices: AIService[];
  stats: {
    totalTools: number;
    availableTools: number;
    totalCalls: number;
    successRate: number;
  };
}

const categoryIcons: Record<string, typeof Wrench> = {
  file: FileCode,
  search: Search,
  web: Globe,
  vision: Eye,
  database: Database,
  terminal: Terminal,
  ai: Brain,
  default: Wrench,
};

const categoryColors: Record<string, string> = {
  file: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  search: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  web: 'bg-green-500/10 text-green-500 border-green-500/20',
  vision: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  database: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  terminal: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  ai: 'bg-honey/10 text-honey border-honey/20',
  default: 'bg-muted text-muted-foreground border-muted',
};

export default function AgentCapabilities() {
  const { data, isLoading, refetch } = useQuery<RegistryData>({
    queryKey: ['/api/tools/registry'],
    queryFn: async () => {
      const res = await fetch(buildApiUrl('/api/tools/registry'));
      if (!res.ok) throw new Error('Failed to fetch tool registry');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const groupedTools = data?.tools.reduce((acc, tool) => {
    const category = tool.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tool);
    return acc;
  }, {} as Record<string, ScoutTool[]>) || {};

  const availabilityPercent = data 
    ? Math.round((data.stats.availableTools / data.stats.totalTools) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" data-testid="page-agent-capabilities">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-honey" />
              Scout Capabilities
            </h1>
            <p className="text-muted-foreground mt-2">View Scout's available tools, AI services, and health status</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            data-testid="button-refresh-capabilities"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-honey/20 flex items-center justify-center">
                      <Wrench className="h-5 w-5 text-honey" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{data.stats.totalTools}</div>
                      <div className="text-xs text-muted-foreground">Total Tools</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{data.stats.availableTools}</div>
                      <div className="text-xs text-muted-foreground">Available</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{data.stats.totalCalls}</div>
                      <div className="text-xs text-muted-foreground">Total Calls</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{data.stats.successRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Success Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Services
                </CardTitle>
                <CardDescription>External AI providers powering Scout's intelligence</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.aiServices.map((service) => (
                    <div 
                      key={service.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          service.status === 'configured' ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          {service.status === 'configured' 
                            ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                            : <XCircle className="h-4 w-4 text-red-500" />
                          }
                        </div>
                        <div>
                          <div className="font-medium text-sm">{service.name}</div>
                          <div className="text-xs text-muted-foreground">{service.provider}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className={
                        service.status === 'configured' 
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }>
                        {service.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Tool Registry
                    </CardTitle>
                    <CardDescription>All tools available to Scout for autonomous work</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Health:</span>
                    <Progress value={availabilityPercent} className="w-24 h-2" />
                    <span className="text-sm font-medium">{availabilityPercent}%</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(groupedTools).map(([category, tools]) => {
                  const CategoryIcon = categoryIcons[category] || categoryIcons.default;
                  const colorClass = categoryColors[category] || categoryColors.default;
                  
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <CategoryIcon className="h-4 w-4" />
                        <h3 className="font-semibold capitalize">{category}</h3>
                        <Badge variant="outline" className="text-xs">
                          {tools.length} tools
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {tools.map((tool) => (
                          <div
                            key={tool.id}
                            className={`p-3 rounded-lg border transition-colors ${
                              tool.isAvailable 
                                ? 'bg-card hover-elevate' 
                                : 'bg-muted/50 opacity-60'
                            }`}
                            data-testid={`tool-card-${tool.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">{tool.name}</span>
                                  {tool.isAvailable 
                                    ? <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                                    : <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                  }
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {tool.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              {tool.requiresAuth && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  <Key className="h-2.5 w-2.5 mr-0.5" />
                                  Auth
                                </Badge>
                              )}
                              {tool.requiresDatabase && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  <Database className="h-2.5 w-2.5 mr-0.5" />
                                  DB
                                </Badge>
                              )}
                              {tool.requiresAIService && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  <Brain className="h-2.5 w-2.5 mr-0.5" />
                                  AI
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="flex items-center justify-center h-64">
            <div className="text-center">
              <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold">Unable to Load Registry</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Failed to fetch tool registry data
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
