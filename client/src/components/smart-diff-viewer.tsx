import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeftRight, 
  Plus, 
  Minus, 
  Edit3, 
  Eye,
  Code,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface DiffChange {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  lineNumber: { old?: number; new?: number };
  content: string;
  semanticType?: 'function' | 'variable' | 'import' | 'class' | 'comment' | 'other';
}

interface SmartDiffViewerProps {
  oldContent: string;
  newContent: string;
  filename?: string;
  language?: string;
  className?: string;
}

export function SmartDiffViewer({ 
  oldContent, 
  newContent, 
  filename,
  language = 'javascript',
  className 
}: SmartDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const diff = useMemo(() => {
    return computeSmartDiff(oldContent, newContent);
  }, [oldContent, newContent]);

  const stats = useMemo(() => {
    const added = diff.filter(d => d.type === 'added').length;
    const removed = diff.filter(d => d.type === 'removed').length;
    const modified = diff.filter(d => d.type === 'modified').length;
    return { added, removed, modified, total: diff.length };
  }, [diff]);

  const toggleSection = (index: number) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const filteredDiff = showUnchanged ? diff : diff.filter(d => d.type !== 'unchanged');

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
          {filename && (
            <span className="font-mono text-sm text-foreground">{filename}</span>
          )}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-green-500/20 text-green-600">
              <Plus className="w-3 h-3 mr-1" />
              {stats.added}
            </Badge>
            <Badge variant="outline" className="text-xs border-red-500/20 text-red-600">
              <Minus className="w-3 h-3 mr-1" />
              {stats.removed}
            </Badge>
            <Badge variant="outline" className="text-xs border-amber-500/20 text-amber-600">
              <Edit3 className="w-3 h-3 mr-1" />
              {stats.modified}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showUnchanged ? "default" : "ghost"}
            onClick={() => setShowUnchanged(!showUnchanged)}
            className="text-xs h-7"
            data-testid="button-toggle-unchanged"
          >
            <Eye className="w-3 h-3 mr-1" />
            {showUnchanged ? "Hide" : "Show"} context
          </Button>
          <div className="flex rounded-md border">
            <Button
              size="sm"
              variant={viewMode === 'unified' ? "default" : "ghost"}
              onClick={() => setViewMode('unified')}
              className="text-xs h-7 rounded-r-none"
              data-testid="button-unified-view"
            >
              Unified
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'split' ? "default" : "ghost"}
              onClick={() => setViewMode('split')}
              className="text-xs h-7 rounded-l-none"
              data-testid="button-split-view"
            >
              Split
            </Button>
          </div>
        </div>
      </div>

      {/* Diff Content */}
      <div className="max-h-[500px] overflow-auto">
        {viewMode === 'unified' ? (
          <UnifiedView 
            diff={filteredDiff} 
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
          />
        ) : (
          <SplitView 
            diff={filteredDiff}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
          />
        )}
      </div>
    </Card>
  );
}

function UnifiedView({ 
  diff, 
  collapsedSections,
  onToggleSection
}: { 
  diff: DiffChange[];
  collapsedSections: Set<number>;
  onToggleSection: (idx: number) => void;
}) {
  return (
    <div className="font-mono text-sm">
      <AnimatePresence mode="popLayout">
        {diff.map((change, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "flex",
              change.type === 'added' && "bg-green-50 dark:bg-green-950/30",
              change.type === 'removed' && "bg-red-50 dark:bg-red-950/30",
              change.type === 'modified' && "bg-amber-50 dark:bg-amber-950/30",
              change.type === 'unchanged' && "bg-transparent"
            )}
          >
            {/* Line numbers */}
            <div className="w-20 flex-shrink-0 flex text-xs text-muted-foreground border-r select-none">
              <span className="w-10 px-2 py-1 text-right border-r">
                {change.lineNumber.old || ''}
              </span>
              <span className="w-10 px-2 py-1 text-right">
                {change.lineNumber.new || ''}
              </span>
            </div>
            
            {/* Change indicator */}
            <div className={cn(
              "w-6 flex-shrink-0 flex items-center justify-center",
              change.type === 'added' && "text-green-600",
              change.type === 'removed' && "text-red-600",
              change.type === 'modified' && "text-amber-600"
            )}>
              {change.type === 'added' && '+'}
              {change.type === 'removed' && '-'}
              {change.type === 'modified' && '~'}
            </div>
            
            {/* Content */}
            <div className="flex-1 px-2 py-1 overflow-x-auto whitespace-pre">
              {change.semanticType && (
                <Badge variant="outline" className="text-[10px] mr-2 h-4">
                  {change.semanticType}
                </Badge>
              )}
              {change.content}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function SplitView({ 
  diff,
  collapsedSections,
  onToggleSection
}: { 
  diff: DiffChange[];
  collapsedSections: Set<number>;
  onToggleSection: (idx: number) => void;
}) {
  return (
    <div className="flex font-mono text-sm">
      {/* Old content */}
      <div className="flex-1 border-r">
        <div className="px-3 py-2 bg-red-50/50 dark:bg-red-950/20 border-b text-xs text-muted-foreground">
          Original
        </div>
        {diff.map((change, index) => (
          <div
            key={`old-${index}`}
            className={cn(
              "flex",
              change.type === 'removed' && "bg-red-50 dark:bg-red-950/30",
              change.type === 'modified' && "bg-amber-50/50 dark:bg-amber-950/20"
            )}
          >
            <span className="w-10 px-2 py-1 text-xs text-muted-foreground text-right border-r select-none">
              {change.lineNumber.old || ''}
            </span>
            <span className="flex-1 px-2 py-1 overflow-x-auto whitespace-pre">
              {(change.type === 'removed' || change.type === 'modified' || change.type === 'unchanged') 
                ? change.content 
                : ''}
            </span>
          </div>
        ))}
      </div>

      {/* New content */}
      <div className="flex-1">
        <div className="px-3 py-2 bg-green-50/50 dark:bg-green-950/20 border-b text-xs text-muted-foreground">
          Modified
        </div>
        {diff.map((change, index) => (
          <div
            key={`new-${index}`}
            className={cn(
              "flex",
              change.type === 'added' && "bg-green-50 dark:bg-green-950/30",
              change.type === 'modified' && "bg-amber-50/50 dark:bg-amber-950/20"
            )}
          >
            <span className="w-10 px-2 py-1 text-xs text-muted-foreground text-right border-r select-none">
              {change.lineNumber.new || ''}
            </span>
            <span className="flex-1 px-2 py-1 overflow-x-auto whitespace-pre">
              {(change.type === 'added' || change.type === 'modified' || change.type === 'unchanged') 
                ? change.content 
                : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeSmartDiff(oldContent: string, newContent: string): DiffChange[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const changes: DiffChange[] = [];
  
  let oldIndex = 0;
  let newIndex = 0;
  
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];
    
    if (oldIndex >= oldLines.length) {
      changes.push({
        type: 'added',
        lineNumber: { new: newIndex + 1 },
        content: newLine,
        semanticType: detectSemanticType(newLine)
      });
      newIndex++;
    } else if (newIndex >= newLines.length) {
      changes.push({
        type: 'removed',
        lineNumber: { old: oldIndex + 1 },
        content: oldLine,
        semanticType: detectSemanticType(oldLine)
      });
      oldIndex++;
    } else if (oldLine === newLine) {
      changes.push({
        type: 'unchanged',
        lineNumber: { old: oldIndex + 1, new: newIndex + 1 },
        content: oldLine
      });
      oldIndex++;
      newIndex++;
    } else {
      const similarity = calculateSimilarity(oldLine, newLine);
      
      if (similarity > 0.5) {
        changes.push({
          type: 'modified',
          lineNumber: { old: oldIndex + 1, new: newIndex + 1 },
          content: newLine,
          semanticType: detectSemanticType(newLine)
        });
        oldIndex++;
        newIndex++;
      } else {
        changes.push({
          type: 'removed',
          lineNumber: { old: oldIndex + 1 },
          content: oldLine,
          semanticType: detectSemanticType(oldLine)
        });
        oldIndex++;
      }
    }
  }
  
  return changes;
}

function detectSemanticType(line: string): DiffChange['semanticType'] {
  const trimmed = line.trim();
  if (/^(function|const\s+\w+\s*=\s*\(|async\s+function|export\s+(async\s+)?function)/.test(trimmed)) {
    return 'function';
  }
  if (/^(const|let|var)\s+\w+/.test(trimmed)) {
    return 'variable';
  }
  if (/^import\s+/.test(trimmed)) {
    return 'import';
  }
  if (/^(class|interface|type)\s+/.test(trimmed)) {
    return 'class';
  }
  if (/^(\/\/|\/\*|\*)/.test(trimmed)) {
    return 'comment';
  }
  return 'other';
}

function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  const longerLength = longer.length;
  if (longerLength === 0) return 1;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longerLength - distance) / longerLength;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}
