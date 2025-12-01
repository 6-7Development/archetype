/**
 * Project Health Dashboard Component
 * 
 * Displays project health metrics, code quality analysis, and improvement suggestions
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Code2, 
  FileCode, 
  FolderTree, 
  Info, 
  Package, 
  RefreshCw, 
  Shield, 
  TestTube,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'declining';
}

interface ComplexityMetrics {
  averageCyclomaticComplexity: number;
  maxCyclomaticComplexity: number;
  highComplexityFiles: { file: string; complexity: number }[];
  averageLinesPerFunction: number;
  totalFunctions: number;
}

interface CoverageMetrics {
  estimatedCoverage: number;
  testFilesCount: number;
  sourceFilesCount: number;
  testToSourceRatio: number;
  hasTestFramework: boolean;
  testFramework?: string;
}

interface StructureMetrics {
  totalFiles: number;
  totalLines: number;
  averageFileSize: number;
  largestFiles: { file: string; lines: number }[];
  filesByLanguage: Record<string, number>;
  directoryDepth: number;
}

interface DependencyMetrics {
  totalDependencies: number;
  outdatedDependencies: number;
  securityVulnerabilities: number;
  devDependencies: number;
  productionDependencies: number;
}

interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'complexity' | 'coverage' | 'structure' | 'dependency' | 'security';
  title: string;
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

interface ProjectHealthMetrics {
  overall: HealthScore;
  complexity: ComplexityMetrics;
  coverage: CoverageMetrics;
  structure: StructureMetrics;
  dependencies: DependencyMetrics;
  issues: HealthIssue[];
  suggestions: string[];
  generatedAt: string;
}

export function ProjectHealthDashboard() {
  const { data: metrics, isLoading, refetch, isFetching } = useQuery<ProjectHealthMetrics>({
    queryKey: ['/api/project-health/analyze'],
  });

  const handleRefresh = async () => {
    await apiRequest('POST', '/api/project-health/refresh');
    queryClient.invalidateQueries({ queryKey: ['/api/project-health/analyze'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="health-loading">
        <div className="text-center space-y-4">
          <Activity className="w-12 h-12 mx-auto text-honey animate-pulse" />
          <p className="text-muted-foreground">Analyzing project health...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="health-error">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
          <p className="text-muted-foreground">Failed to load health metrics</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-mint bg-mint/10 border-mint/20';
      case 'B': return 'text-mint/80 bg-mint/10 border-mint/20';
      case 'C': return 'text-honey bg-honey/10 border-honey/20';
      case 'D': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'F': return 'text-destructive bg-destructive/10 border-destructive/20';
      default: return 'text-muted-foreground bg-muted/10 border-muted/20';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-mint" />;
      case 'declining': return <TrendingDown className="w-4 h-4 text-destructive" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const criticalCount = metrics.issues.filter(i => i.severity === 'critical').length;
  const warningCount = metrics.issues.filter(i => i.severity === 'warning').length;
  const infoCount = metrics.issues.filter(i => i.severity === 'info').length;

  return (
    <div className="h-full flex flex-col" data-testid="health-dashboard">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-honey" />
          <h2 className="text-lg font-semibold">Project Health</h2>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isFetching}
          data-testid="button-refresh-health"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className={cn("border-2", getGradeColor(metrics.overall.grade))}>
              <CardHeader className="pb-2">
                <CardDescription>Overall Score</CardDescription>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-4xl">{metrics.overall.grade}</CardTitle>
                  {getTrendIcon(metrics.overall.trend)}
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={metrics.overall.score} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1">{metrics.overall.score}/100</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  Complexity
                </CardDescription>
                <CardTitle className="text-2xl">{metrics.complexity.averageCyclomaticComplexity}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Max: {metrics.complexity.maxCyclomaticComplexity} | 
                  {metrics.complexity.totalFunctions} functions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TestTube className="w-4 h-4" />
                  Test Coverage
                </CardDescription>
                <CardTitle className="text-2xl">{metrics.coverage.estimatedCoverage}%</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={metrics.coverage.estimatedCoverage} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.coverage.testFilesCount} test files
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Dependencies
                </CardDescription>
                <CardTitle className="text-2xl">{metrics.dependencies.totalDependencies}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {metrics.dependencies.productionDependencies} prod | 
                  {metrics.dependencies.devDependencies} dev
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Issues</CardTitle>
                <div className="flex gap-2">
                  {criticalCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {criticalCount}
                    </Badge>
                  )}
                  {warningCount > 0 && (
                    <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {warningCount}
                    </Badge>
                  )}
                  {infoCount > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Info className="w-3 h-3" />
                      {infoCount}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {metrics.issues.length === 0 ? (
                <div className="flex items-center gap-2 text-mint py-4">
                  <CheckCircle2 className="w-5 h-5" />
                  <p>No issues found. Great job!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {metrics.issues.map((issue, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      data-testid={`health-issue-${index}`}
                    >
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{issue.title}</p>
                        <p className="text-xs text-muted-foreground">{issue.description}</p>
                        {issue.file && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {issue.file}
                          </p>
                        )}
                        {issue.suggestion && (
                          <p className="text-xs text-mint mt-1">{issue.suggestion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="structure">
            <TabsList>
              <TabsTrigger value="structure" className="gap-2">
                <FolderTree className="w-4 h-4" />
                Structure
              </TabsTrigger>
              <TabsTrigger value="complexity" className="gap-2">
                <Code2 className="w-4 h-4" />
                Complexity
              </TabsTrigger>
              <TabsTrigger value="suggestions" className="gap-2">
                <Shield className="w-4 h-4" />
                Suggestions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="structure" className="mt-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{metrics.structure.totalFiles}</p>
                      <p className="text-xs text-muted-foreground">Total Files</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{metrics.structure.totalLines.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Lines of Code</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{metrics.structure.averageFileSize}</p>
                      <p className="text-xs text-muted-foreground">Avg Lines/File</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{metrics.structure.directoryDepth}</p>
                      <p className="text-xs text-muted-foreground">Max Depth</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Largest Files</p>
                    <div className="space-y-2">
                      {metrics.structure.largestFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs truncate flex-1">{file.file}</span>
                          <Badge variant="secondary">{file.lines} lines</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Files by Language</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(metrics.structure.filesByLanguage).map(([lang, count]) => (
                        <Badge key={lang} variant="outline">
                          .{lang}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="complexity" className="mt-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-center mb-4">
                    <div>
                      <p className="text-2xl font-bold">{metrics.complexity.totalFunctions}</p>
                      <p className="text-xs text-muted-foreground">Functions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{metrics.complexity.averageLinesPerFunction}</p>
                      <p className="text-xs text-muted-foreground">Avg Lines/Function</p>
                    </div>
                  </div>

                  {metrics.complexity.highComplexityFiles.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">High Complexity Files</p>
                      <div className="space-y-2">
                        {metrics.complexity.highComplexityFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="font-mono text-xs truncate flex-1">
                              <FileCode className="w-3 h-3 inline mr-1" />
                              {file.file}
                            </span>
                            <Badge 
                              variant="outline"
                              className={file.complexity > 15 ? 'text-destructive' : 'text-amber-500'}
                            >
                              CC: {file.complexity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="suggestions" className="mt-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {metrics.suggestions.map((suggestion, index) => (
                      <div 
                        key={index} 
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <CheckCircle2 className="w-4 h-4 text-mint mt-0.5" />
                        <p className="text-sm">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground text-center">
            Last analyzed: {new Date(metrics.generatedAt).toLocaleString()}
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
