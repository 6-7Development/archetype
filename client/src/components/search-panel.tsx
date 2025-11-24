import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface SearchResult {
  file: string;
  line: number;
  text: string;
  match: string;
}

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([
    { file: 'App.tsx', line: 42, text: 'const App = () => {', match: 'App' },
    { file: 'workspace-layout.tsx', line: 156, text: 'export function WorkspaceLayout({', match: 'WorkspaceLayout' },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Find in project..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="text-xs h-8"
          data-testid="input-search"
        />
      </div>

      <div className="flex items-center gap-1 mb-3">
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={results.length === 0}>
          <ChevronUp className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={results.length === 0}>
          <ChevronDown className="w-3 h-3" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {results.length > 0 ? `${currentIndex + 1} of ${results.length}` : 'No results'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {results.map((result, i) => (
          <Card
            key={i}
            className={`p-2 cursor-pointer transition-colors ${
              i === currentIndex ? 'bg-primary/10' : 'hover:bg-muted/50'
            }`}
            onClick={() => setCurrentIndex(i)}
          >
            <div className="text-xs font-mono">
              <div className="font-semibold text-foreground">{result.file}:{result.line}</div>
              <div className="text-muted-foreground mt-1 truncate">{result.text}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-3 bg-muted/50">
        <p className="text-xs text-muted-foreground">
          Use Ctrl+Shift+F (Cmd+Shift+F on Mac) to search across files
        </p>
      </Card>
    </div>
  );
}
