import { Database, Plus, RefreshCw, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function DatabaseViewer() {
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleExecute = async () => {
    setIsLoading(true);
    try {
      // Mock execution - replace with actual API call
      const response = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        credentials: 'include',
      });
      const data = await response.json();
      setResults(data.rows || []);
    } catch (error) {
      console.error('Query failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <Tabs defaultValue="query" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="query">Query Runner</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
        </TabsList>

        <TabsContent value="query" className="flex-1 flex flex-col overflow-hidden">
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            <div>
              <label className="text-xs font-semibold">SQL Query:</label>
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="font-mono text-xs h-24 resize-none"
                placeholder="SELECT * FROM table_name LIMIT 10;"
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleExecute}
                disabled={isLoading}
                data-testid="button-execute-query"
              >
                {isLoading ? 'Executing...' : 'Execute'}
              </Button>
              <Button size="sm" variant="outline">
                <RefreshCw className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>

            {results.length > 0 && (
              <div className="flex-1 overflow-hidden border rounded-md bg-background/50">
                <div className="h-full overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b sticky top-0 bg-muted">
                      <tr>
                        {Object.keys(results[0] || {}).map((key) => (
                          <th key={key} className="p-2 text-left font-semibold">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row, i) => (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="p-2 font-mono">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="schema" className="flex-1 overflow-auto">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4" />
              <h3 className="font-semibold text-sm">Database Schema</h3>
              <Badge variant="outline" className="ml-auto">PostgreSQL</Badge>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Tables, columns, and indexes will appear here</p>
              <p>Connect to your database to view the schema</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
