import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { SpellCheck, AlertTriangle, Check, Plus, RefreshCw, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SpellingError {
  word: string;
  position: { line: number; start: number; end: number };
  suggestions: string[];
  context?: string;
}

interface SpellCheckerProps {
  content: string;
  language?: 'en-US' | 'en-GB';
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  onFix?: (error: SpellingError, replacement: string) => void;
  onAddToDictionary?: (word: string) => void;
  customDictionary?: string[];
  className?: string;
}

const COMMON_TECH_WORDS = new Set([
  'api', 'apis', 'async', 'await', 'backend', 'boolean', 'callback', 'cli',
  'config', 'const', 'css', 'db', 'devops', 'dockerfile', 'dom', 'env',
  'eslint', 'frontend', 'github', 'graphql', 'html', 'http', 'https', 'io',
  'javascript', 'js', 'json', 'jsx', 'kubernetes', 'linux', 'localhost',
  'middleware', 'mongodb', 'mysql', 'nginx', 'node', 'nodejs', 'npm',
  'postgres', 'postgresql', 'python', 'react', 'redis', 'regex', 'replit',
  'rest', 'restful', 'sdk', 'sql', 'ssr', 'ssl', 'svg', 'tsx', 'typescript',
  'ui', 'url', 'uuid', 'vite', 'webpack', 'websocket', 'yaml', 'yml',
  'hexad', 'lomu', 'drizzle', 'zod', 'tanstack', 'shadcn', 'tailwind',
]);

const COMMON_ABBREVIATIONS = new Set([
  'e.g.', 'i.e.', 'etc.', 'vs.', 'approx.', 'incl.', 'excl.',
]);

function checkSpelling(text: string, customDict: Set<string> = new Set()): SpellingError[] {
  const errors: SpellingError[] = [];
  const lines = text.split('\n');
  
  const wordRegex = /\b[a-zA-Z][a-zA-Z'-]*[a-zA-Z]\b|\b[a-zA-Z]\b/g;
  
  lines.forEach((line, lineIndex) => {
    let match;
    while ((match = wordRegex.exec(line)) !== null) {
      const word = match[0].toLowerCase();
      
      if (word.length < 2) continue;
      
      if (COMMON_TECH_WORDS.has(word) || customDict.has(word)) continue;
      
      if (/^[A-Z][a-z]+[A-Z]/.test(match[0])) continue;
      
      if (/^[A-Z]{2,}$/.test(match[0])) continue;
      
      if (line.substring(match.index - 1, match.index) === '`') continue;
      
      if (!isValidEnglishWord(word)) {
        errors.push({
          word: match[0],
          position: {
            line: lineIndex + 1,
            start: match.index,
            end: match.index + match[0].length,
          },
          suggestions: generateSuggestions(word),
          context: getContext(line, match.index, match[0].length),
        });
      }
    }
  });
  
  return errors;
}

function isValidEnglishWord(word: string): boolean {
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
    'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
    'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'back',
    'after', 'use', 'two', 'way', 'about', 'many', 'then', 'them', 'write',
    'would', 'like', 'her', 'him', 'into', 'time', 'has', 'look', 'more',
    'day', 'could', 'go', 'come', 'did', 'number', 'sound', 'no', 'most',
    'people', 'my', 'over', 'know', 'water', 'than', 'call', 'first', 'who',
    'may', 'down', 'side', 'been', 'now', 'find', 'any', 'new', 'work',
    'part', 'take', 'get', 'place', 'made', 'live', 'where', 'after', 'back',
    'little', 'only', 'round', 'man', 'year', 'came', 'show', 'every', 'good',
    'me', 'give', 'our', 'under', 'name', 'very', 'through', 'just', 'form',
    'sentence', 'great', 'think', 'say', 'help', 'low', 'line', 'differ',
    'turn', 'cause', 'much', 'mean', 'before', 'move', 'right', 'boy', 'old',
    'too', 'same', 'tell', 'does', 'set', 'three', 'want', 'air', 'well',
    'also', 'play', 'small', 'end', 'put', 'home', 'read', 'hand', 'port',
    'large', 'spell', 'add', 'even', 'land', 'here', 'must', 'big', 'high',
    'such', 'follow', 'act', 'why', 'ask', 'men', 'change', 'went', 'light',
    'kind', 'off', 'need', 'house', 'picture', 'try', 'us', 'again', 'animal',
    'point', 'mother', 'world', 'near', 'build', 'self', 'earth', 'father',
    'create', 'feature', 'file', 'code', 'project', 'user', 'data', 'system',
    'application', 'function', 'method', 'class', 'type', 'interface', 'module',
    'component', 'service', 'server', 'client', 'request', 'response', 'error',
    'success', 'message', 'content', 'text', 'value', 'key', 'list', 'array',
    'object', 'string', 'number', 'true', 'false', 'null', 'undefined',
  ]);
  
  return commonWords.has(word.toLowerCase());
}

function generateSuggestions(word: string): string[] {
  const suggestions: string[] = [];
  
  const lowercase = word.toLowerCase();
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  
  const commonMisspellings: Record<string, string[]> = {
    'teh': ['the'],
    'recieve': ['receive'],
    'seperate': ['separate'],
    'occured': ['occurred'],
    'untill': ['until'],
    'wich': ['which'],
    'becuase': ['because'],
    'definately': ['definitely'],
    'accomodate': ['accommodate'],
    'occurence': ['occurrence'],
  };
  
  if (commonMisspellings[lowercase]) {
    return commonMisspellings[lowercase];
  }
  
  if (word.length > 4) {
    suggestions.push(word.slice(0, -1));
    suggestions.push(word.slice(0, -2));
  }
  
  return suggestions.slice(0, 5);
}

function getContext(line: string, start: number, length: number): string {
  const contextStart = Math.max(0, start - 20);
  const contextEnd = Math.min(line.length, start + length + 20);
  
  let context = line.substring(contextStart, contextEnd);
  if (contextStart > 0) context = '...' + context;
  if (contextEnd < line.length) context = context + '...';
  
  return context;
}

export function SpellChecker({
  content,
  language = 'en-US',
  enabled = true,
  onToggle,
  onFix,
  onAddToDictionary,
  customDictionary = [],
  className,
}: SpellCheckerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [localDictionary, setLocalDictionary] = useState<Set<string>>(
    new Set(customDictionary.map(w => w.toLowerCase()))
  );

  const errors = useMemo(() => {
    if (!localEnabled) return [];
    return checkSpelling(content, localDictionary);
  }, [content, localEnabled, localDictionary]);

  const handleToggle = useCallback((value: boolean) => {
    setLocalEnabled(value);
    onToggle?.(value);
  }, [onToggle]);

  const handleAddToDictionary = useCallback((word: string) => {
    const lowerWord = word.toLowerCase();
    setLocalDictionary(prev => new Set([...prev, lowerWord]));
    onAddToDictionary?.(word);
  }, [onAddToDictionary]);

  const handleFix = useCallback((error: SpellingError, replacement: string) => {
    onFix?.(error, replacement);
  }, [onFix]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 gap-1.5 text-xs", className)}
          data-testid="button-spell-checker"
        >
          <SpellCheck className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Spell Check</span>
          {errors.length > 0 && (
            <Badge variant="destructive" className="h-4 px-1 text-[10px]">
              {errors.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" data-testid="spell-checker-popover">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <SpellCheck className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Spell Checker</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={localEnabled}
              onCheckedChange={handleToggle}
              className="h-4 w-7"
              data-testid="switch-spell-check"
            />
            <span className="text-xs text-muted-foreground">
              {localEnabled ? 'On' : 'Off'}
            </span>
          </div>
        </div>

        {localEnabled && (
          <ScrollArea className="max-h-72">
            {errors.length > 0 ? (
              <div className="divide-y">
                {errors.map((error, index) => (
                  <div
                    key={`${error.word}-${error.position.line}-${index}`}
                    className="px-3 py-2"
                    data-testid={`spelling-error-${index}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-amber-600">
                        "{error.word}"
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Line {error.position.line}
                      </span>
                    </div>
                    
                    {error.context && (
                      <p className="text-xs text-muted-foreground mb-2 pl-5 font-mono">
                        {error.context}
                      </p>
                    )}
                    
                    {error.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-5 mb-1">
                        {error.suggestions.map((suggestion, sIndex) => (
                          <Button
                            key={`${suggestion}-${sIndex}`}
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleFix(error, suggestion)}
                            data-testid={`suggestion-${index}-${sIndex}`}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs ml-5"
                      onClick={() => handleAddToDictionary(error.word)}
                      data-testid={`add-to-dictionary-${index}`}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add to dictionary
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8" data-testid="no-spelling-errors">
                <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No spelling errors found
                </p>
              </div>
            )}
          </ScrollArea>
        )}

        <div className="px-3 py-2 border-t bg-secondary/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>{localDictionary.size} words in custom dictionary</span>
          <span>Language: {language}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function useSpellCheck(content: string, enabled = true) {
  const [customDictionary, setCustomDictionary] = useState<string[]>([]);
  
  useEffect(() => {
    const saved = localStorage.getItem('hexad-spell-dictionary');
    if (saved) {
      try {
        setCustomDictionary(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const addToDictionary = useCallback((word: string) => {
    setCustomDictionary(prev => {
      const next = [...prev, word.toLowerCase()];
      localStorage.setItem('hexad-spell-dictionary', JSON.stringify(next));
      return next;
    });
  }, []);

  const errors = useMemo(() => {
    if (!enabled) return [];
    return checkSpelling(content, new Set(customDictionary));
  }, [content, enabled, customDictionary]);

  return {
    errors,
    customDictionary,
    addToDictionary,
    errorCount: errors.length,
  };
}
