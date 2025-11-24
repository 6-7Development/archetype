import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Download, ChevronRight, Calendar } from 'lucide-react';
import { buildApiUrl } from '@/lib/api-utils';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { InlineReasoning } from '@/components/inline-reasoning';

export default function ConsultationHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: consultations = [], isLoading } = useQuery({
    queryKey: ['/api/architect/consultations'],
    queryFn: async () => {
      const res = await fetch(buildApiUrl('/api/architect/consultations'), {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch consultations');
      const data = await res.json();
      return data.consultations || [];
    }
  });

  const filtered = consultations.filter((c: any) =>
    c.problem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.guidance?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selected = consultations.find((c: any) => c.id === selectedId);

  const handleExport = (consultation: any) => {
    const markdown = `# Architectural Consultation

**Date**: ${new Date(consultation.createdAt).toLocaleString()}
**Problem**: ${consultation.problem}

## Guidance
${consultation.guidance}

## Recommendations
${consultation.recommendations?.map((r: string) => `- ${r}`).join('\n') || 'No recommendations'}

## Files Inspected
${consultation.filesInspected?.map((f: string) => `- ${f}`).join('\n') || 'None'}

## Evidence Used
${consultation.evidenceUsed?.map((e: string) => `- ${e}`).join('\n') || 'None'}

## Tokens Used
- Input: ${consultation.inputTokens || 0}
- Output: ${consultation.outputTokens || 0}
`;
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consultation-${new Date(consultation.createdAt).getTime()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">I AM Architect Consultations</h1>
          <p className="text-muted-foreground mt-2">Browse and review past architectural guidance from I AM Architect</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search consultations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase">
              {filtered.length} Consultation{filtered.length !== 1 ? 's' : ''}
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="text-sm text-muted-foreground p-4">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4">No consultations found</div>
              ) : (
                filtered.map((c: any) => (
                  <Card
                    key={c.id}
                    className={`cursor-pointer transition-colors ${selectedId === c.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{c.problem.substring(0, 40)}...</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(c.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-transform ${selectedId === c.id ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <Card className="h-full">
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{selected.problem}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(selected.createdAt).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(selected)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 pt-6 max-h-[600px] overflow-y-auto">
                  {/* Guidance */}
                  <div>
                    <h3 className="font-semibold text-sm mb-3">Strategic Guidance</h3>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <MarkdownRenderer content={selected.guidance} />
                    </div>
                  </div>

                  {/* Recommendations */}
                  {selected.recommendations?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-sm mb-3">Recommendations</h3>
                      <ul className="space-y-2">
                        {selected.recommendations.map((r: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground flex gap-2">
                            <span className="text-primary font-bold">•</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Files & Evidence */}
                  <div className="grid grid-cols-2 gap-4">
                    {selected.filesInspected?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Files Inspected ({selected.filesInspected.length})</h4>
                        <div className="space-y-1">
                          {selected.filesInspected.slice(0, 5).map((f: string, i: number) => (
                            <div key={i} className="text-xs bg-muted p-1.5 rounded font-mono truncate" title={f}>
                              {f.split('/').pop()}
                            </div>
                          ))}
                          {selected.filesInspected.length > 5 && (
                            <div className="text-xs text-muted-foreground">+{selected.filesInspected.length - 5} more</div>
                          )}
                        </div>
                      </div>
                    )}

                    {selected.evidenceUsed?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Evidence Used ({selected.evidenceUsed.length})</h4>
                        <div className="space-y-1">
                          {selected.evidenceUsed.slice(0, 5).map((e: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {e}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Token Usage */}
                  {(selected.inputTokens || selected.outputTokens) && (
                    <div className="bg-muted/50 p-3 rounded text-xs space-y-1">
                      <div className="font-semibold mb-2">Token Usage</div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Input Tokens:</span>
                        <span className="font-mono">{selected.inputTokens || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Output Tokens:</span>
                        <span className="font-mono">{selected.outputTokens || 0}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="flex items-center justify-center h-full min-h-[400px]">
                <CardContent className="text-center text-muted-foreground">
                  <p>Select a consultation to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
