import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Navigation, FileCode, ArrowRight, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SymbolLocation {
  path: string;
  line: number;
  column: number;
  name: string;
  kind: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'import' | 'export';
  preview?: string;
}

export interface DefinitionResult {
  symbol: string;
  locations: SymbolLocation[];
  references?: SymbolLocation[];
}

interface GoToDefinitionProps {
  projectId?: string;
  currentFile?: string;
  selectedSymbol?: string;
  cursorPosition?: { line: number; column: number };
  onNavigate?: (location: SymbolLocation) => void;
  className?: string;
}

const KIND_COLORS: Record<SymbolLocation['kind'], string> = {
  function: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  class: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  variable: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  interface: 'bg-green-500/10 text-green-600 border-green-500/30',
  type: 'bg-teal-500/10 text-teal-600 border-teal-500/30',
  import: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
  export: 'bg-pink-500/10 text-pink-600 border-pink-500/30',
};

export function GoToDefinition({
  projectId,
  currentFile,
  selectedSymbol,
  cursorPosition,
  onNavigate,
  className,
}: GoToDefinitionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchSymbol, setSearchSymbol] = useState('');

  const { data: definition, isLoading, refetch } = useQuery<DefinitionResult>({
    queryKey: ['/api/code-intel/definition', projectId, currentFile, selectedSymbol],
    enabled: !!projectId && !!selectedSymbol && isOpen,
  });

  const handleSymbolClick = useCallback((location: SymbolLocation) => {
    onNavigate?.(location);
    setIsOpen(false);
  }, [onNavigate]);

  useEffect(() => {
    if (selectedSymbol) {
      setSearchSymbol(selectedSymbol);
    }
  }, [selectedSymbol]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F12' || (e.ctrlKey && e.key === 'b')) {
      e.preventDefault();
      setIsOpen(true);
      refetch();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={className} onKeyDown={handleKeyDown}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={!selectedSymbol}
            data-testid="button-go-to-definition"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Go to Definition</span>
            <kbd className="hidden md:inline-flex ml-1 h-4 px-1 bg-secondary rounded text-[10px] items-center">F12</kbd>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start" data-testid="go-to-definition-popover">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Definition</span>
              {selectedSymbol && (
                <Badge variant="secondary" className="text-xs">
                  {selectedSymbol}
                </Badge>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
              data-testid="button-close-definition"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          <ScrollArea className="max-h-72">
            {isLoading ? (
              <div className="flex items-center justify-center py-8" data-testid="definition-loading">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : definition?.locations && definition.locations.length > 0 ? (
              <div className="divide-y">
                {definition.locations.map((location, index) => (
                  <button
                    key={`${location.path}-${location.line}-${index}`}
                    onClick={() => handleSymbolClick(location)}
                    className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors group"
                    data-testid={`definition-location-${index}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileCode className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">
                        {location.path.split('/').pop()}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] h-4", KIND_COLORS[location.kind])}
                      >
                        {location.kind}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-5">
                      <span className="truncate">{location.path}</span>
                      <ArrowRight className="w-3 h-3 flex-shrink-0" />
                      <span className="flex-shrink-0">
                        Line {location.line}:{location.column}
                      </span>
                    </div>
                    
                    {location.preview && (
                      <pre className="mt-1.5 ml-5 text-xs bg-secondary/30 rounded px-2 py-1 overflow-x-auto text-muted-foreground font-mono">
                        {location.preview}
                      </pre>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground" data-testid="definition-empty">
                {selectedSymbol ? (
                  <p>No definition found for "{selectedSymbol}"</p>
                ) : (
                  <p>Select a symbol to find its definition</p>
                )}
              </div>
            )}
          </ScrollArea>

          {definition?.references && definition.references.length > 0 && (
            <div className="border-t">
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-secondary/30">
                References ({definition.references.length})
              </div>
              <ScrollArea className="max-h-32">
                <div className="divide-y">
                  {definition.references.slice(0, 5).map((ref, index) => (
                    <button
                      key={`ref-${ref.path}-${ref.line}-${index}`}
                      onClick={() => handleSymbolClick(ref)}
                      className="w-full text-left px-3 py-1.5 hover:bg-secondary/50 transition-colors text-xs"
                      data-testid={`reference-location-${index}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate flex-1 text-muted-foreground">
                          {ref.path}
                        </span>
                        <span className="flex-shrink-0 text-muted-foreground/70">
                          :{ref.line}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="px-3 py-2 border-t bg-secondary/20 text-xs text-muted-foreground">
            <span className="font-medium">Tip:</span> Press <kbd className="mx-1 px-1 bg-secondary rounded">F12</kbd> on a symbol to jump to definition
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function useGoToDefinition(
  editorRef: React.RefObject<any>,
  onNavigate?: (location: SymbolLocation) => void
) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | undefined>();
  const [cursorPosition, setCursorPosition] = useState<{ line: number; column: number } | undefined>();

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleCursorChange = () => {
      const position = editor.getPosition();
      if (position) {
        setCursorPosition({ line: position.lineNumber, column: position.column });
        
        const model = editor.getModel();
        if (model) {
          const word = model.getWordAtPosition(position);
          if (word) {
            setSelectedSymbol(word.word);
          }
        }
      }
    };

    const disposable = editor.onDidChangeCursorPosition(handleCursorChange);
    
    return () => {
      disposable?.dispose();
    };
  }, [editorRef]);

  return {
    selectedSymbol,
    cursorPosition,
  };
}
