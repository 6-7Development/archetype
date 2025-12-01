/**
 * Smart Code Completion Service
 * 
 * AI-powered context-aware code completion using Gemini
 * Provides intelligent suggestions based on:
 * - Current code context
 * - Project file structure
 * - Language semantics
 * - User coding patterns
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genai = new GoogleGenerativeAI(apiKey);

export interface CompletionRequest {
  code: string;
  cursorPosition: { line: number; column: number };
  language: string;
  filePath?: string;
  projectContext?: string[];
  triggerKind: 'invoke' | 'automatic' | 'triggerCharacter';
  triggerCharacter?: string;
}

export interface CompletionItem {
  label: string;
  kind: CompletionKind;
  detail?: string;
  documentation?: string;
  insertText: string;
  insertTextRules?: number;
  sortText?: string;
  filterText?: string;
  preselect?: boolean;
  range?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

export enum CompletionKind {
  Method = 0,
  Function = 1,
  Constructor = 2,
  Field = 3,
  Variable = 4,
  Class = 5,
  Struct = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Event = 10,
  Operator = 11,
  Unit = 12,
  Value = 13,
  Constant = 14,
  Enum = 15,
  EnumMember = 16,
  Keyword = 17,
  Text = 18,
  Color = 19,
  File = 20,
  Reference = 21,
  Customcolor = 22,
  Folder = 23,
  TypeParameter = 24,
  User = 25,
  Issue = 26,
  Snippet = 27,
}

export interface CompletionResponse {
  suggestions: CompletionItem[];
  isIncomplete: boolean;
  processingTimeMs: number;
}

class CodeCompletionService {
  private completionCache: Map<string, { suggestions: CompletionItem[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 30000;
  private readonly MAX_CACHE_SIZE = 100;
  private requestCount = 0;
  private totalLatency = 0;

  constructor() {
    console.log('[CODE-COMPLETION] Smart Code Completion service initialized');
  }

  async getCompletions(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey(request);
      const cached = this.completionCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return {
          suggestions: cached.suggestions,
          isIncomplete: false,
          processingTimeMs: Date.now() - startTime,
        };
      }

      const contextLines = this.extractContextLines(request.code, request.cursorPosition);
      const prompt = this.buildCompletionPrompt(contextLines, request);
      
      const suggestions = await this.generateCompletions(prompt, request);
      
      this.cacheCompletions(cacheKey, suggestions);
      
      const processingTimeMs = Date.now() - startTime;
      this.updateMetrics(processingTimeMs);

      return {
        suggestions,
        isIncomplete: suggestions.length >= 10,
        processingTimeMs,
      };
    } catch (error: any) {
      console.error('[CODE-COMPLETION] Error generating completions:', error.message);
      return {
        suggestions: this.getStaticCompletions(request.language),
        isIncomplete: false,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  private generateCacheKey(request: CompletionRequest): string {
    const lineContext = request.code.split('\n').slice(
      Math.max(0, request.cursorPosition.line - 3),
      request.cursorPosition.line + 1
    ).join('\n');
    return `${request.language}:${lineContext}:${request.cursorPosition.column}`;
  }

  private extractContextLines(code: string, position: { line: number; column: number }): string {
    const lines = code.split('\n');
    const startLine = Math.max(0, position.line - 10);
    const endLine = Math.min(lines.length, position.line + 3);
    
    const contextLines = lines.slice(startLine, endLine);
    const cursorLine = position.line - startLine;
    
    if (cursorLine >= 0 && cursorLine < contextLines.length) {
      const line = contextLines[cursorLine];
      contextLines[cursorLine] = line.substring(0, position.column) + '|CURSOR|' + line.substring(position.column);
    }
    
    return contextLines.join('\n');
  }

  private buildCompletionPrompt(contextLines: string, request: CompletionRequest): string {
    return `You are an expert code completion AI. Analyze the code context and suggest completions.

Language: ${request.language}
${request.filePath ? `File: ${request.filePath}` : ''}

Code context (|CURSOR| marks cursor position):
\`\`\`${request.language}
${contextLines}
\`\`\`

${request.projectContext?.length ? `Related project files: ${request.projectContext.join(', ')}` : ''}

Provide 5-10 intelligent code completions. Return ONLY a JSON array of completion objects:
[
  {
    "label": "completion text shown",
    "insertText": "actual code to insert",
    "kind": "Function|Variable|Method|Property|Class|Keyword|Snippet",
    "detail": "short type/signature info",
    "documentation": "brief description"
  }
]

Focus on:
1. Contextually relevant completions based on surrounding code
2. Common patterns for ${request.language}
3. Method/property completions if after a dot
4. Import suggestions if at top of file
5. Variable names from scope
6. Type-appropriate suggestions`;
  }

  private async generateCompletions(prompt: string, request: CompletionRequest): Promise<CompletionItem[]> {
    const model = genai.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        topP: 0.8,
      }
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return this.getStaticCompletions(request.language);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((item: any, index: number) => ({
        label: item.label || item.insertText,
        insertText: item.insertText || item.label,
        kind: this.mapKind(item.kind),
        detail: item.detail || '',
        documentation: item.documentation || '',
        sortText: String(index).padStart(4, '0'),
        preselect: index === 0,
      }));
    } catch (parseError) {
      console.error('[CODE-COMPLETION] Failed to parse AI response:', parseError);
      return this.getStaticCompletions(request.language);
    }
  }

  private mapKind(kind: string): CompletionKind {
    const kindMap: Record<string, CompletionKind> = {
      'Function': CompletionKind.Function,
      'Method': CompletionKind.Method,
      'Variable': CompletionKind.Variable,
      'Property': CompletionKind.Property,
      'Class': CompletionKind.Class,
      'Interface': CompletionKind.Interface,
      'Module': CompletionKind.Module,
      'Keyword': CompletionKind.Keyword,
      'Snippet': CompletionKind.Snippet,
      'Constant': CompletionKind.Constant,
      'Enum': CompletionKind.Enum,
      'Field': CompletionKind.Field,
      'Constructor': CompletionKind.Constructor,
    };
    return kindMap[kind] || CompletionKind.Text;
  }

  private getStaticCompletions(language: string): CompletionItem[] {
    const languageSnippets: Record<string, CompletionItem[]> = {
      javascript: [
        { label: 'console.log', insertText: 'console.log($1)', kind: CompletionKind.Function, detail: 'Log to console' },
        { label: 'const', insertText: 'const ${1:name} = $2', kind: CompletionKind.Keyword, detail: 'Constant declaration' },
        { label: 'function', insertText: 'function ${1:name}($2) {\n\t$3\n}', kind: CompletionKind.Snippet, detail: 'Function declaration' },
        { label: 'async function', insertText: 'async function ${1:name}($2) {\n\t$3\n}', kind: CompletionKind.Snippet, detail: 'Async function' },
        { label: 'arrow function', insertText: '($1) => {\n\t$2\n}', kind: CompletionKind.Snippet, detail: 'Arrow function' },
        { label: 'try-catch', insertText: 'try {\n\t$1\n} catch (error) {\n\t$2\n}', kind: CompletionKind.Snippet, detail: 'Try-catch block' },
        { label: 'if', insertText: 'if ($1) {\n\t$2\n}', kind: CompletionKind.Snippet, detail: 'If statement' },
        { label: 'for loop', insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t$3\n}', kind: CompletionKind.Snippet, detail: 'For loop' },
      ],
      typescript: [
        { label: 'interface', insertText: 'interface ${1:Name} {\n\t$2\n}', kind: CompletionKind.Snippet, detail: 'Interface declaration' },
        { label: 'type', insertText: 'type ${1:Name} = $2', kind: CompletionKind.Snippet, detail: 'Type alias' },
        { label: 'async function', insertText: 'async function ${1:name}($2): Promise<$3> {\n\t$4\n}', kind: CompletionKind.Snippet, detail: 'Typed async function' },
        { label: 'const typed', insertText: 'const ${1:name}: ${2:Type} = $3', kind: CompletionKind.Snippet, detail: 'Typed constant' },
        { label: 'export', insertText: 'export { $1 }', kind: CompletionKind.Keyword, detail: 'Named export' },
        { label: 'import', insertText: "import { $1 } from '$2'", kind: CompletionKind.Keyword, detail: 'Named import' },
        { label: 'class', insertText: 'class ${1:Name} {\n\tconstructor($2) {\n\t\t$3\n\t}\n}', kind: CompletionKind.Snippet, detail: 'Class declaration' },
      ],
      python: [
        { label: 'def', insertText: 'def ${1:function_name}($2):\n\t$3', kind: CompletionKind.Snippet, detail: 'Function definition' },
        { label: 'class', insertText: 'class ${1:ClassName}:\n\tdef __init__(self$2):\n\t\t$3', kind: CompletionKind.Snippet, detail: 'Class definition' },
        { label: 'if', insertText: 'if $1:\n\t$2', kind: CompletionKind.Snippet, detail: 'If statement' },
        { label: 'for', insertText: 'for ${1:item} in ${2:items}:\n\t$3', kind: CompletionKind.Snippet, detail: 'For loop' },
        { label: 'try-except', insertText: 'try:\n\t$1\nexcept ${2:Exception} as e:\n\t$3', kind: CompletionKind.Snippet, detail: 'Try-except block' },
        { label: 'with', insertText: "with open('${1:file}', '${2:r}') as f:\n\t$3", kind: CompletionKind.Snippet, detail: 'Context manager' },
        { label: 'async def', insertText: 'async def ${1:function_name}($2):\n\t$3', kind: CompletionKind.Snippet, detail: 'Async function' },
      ],
      html: [
        { label: 'div', insertText: '<div class="$1">$2</div>', kind: CompletionKind.Snippet, detail: 'Div element' },
        { label: 'button', insertText: '<button type="${1:button}">$2</button>', kind: CompletionKind.Snippet, detail: 'Button element' },
        { label: 'input', insertText: '<input type="${1:text}" placeholder="$2" />', kind: CompletionKind.Snippet, detail: 'Input element' },
        { label: 'link', insertText: '<a href="$1">$2</a>', kind: CompletionKind.Snippet, detail: 'Anchor element' },
        { label: 'img', insertText: '<img src="$1" alt="$2" />', kind: CompletionKind.Snippet, detail: 'Image element' },
      ],
      css: [
        { label: 'flex-center', insertText: 'display: flex;\njustify-content: center;\nalign-items: center;', kind: CompletionKind.Snippet, detail: 'Flexbox center' },
        { label: 'grid', insertText: 'display: grid;\ngrid-template-columns: $1;\ngap: $2;', kind: CompletionKind.Snippet, detail: 'CSS Grid' },
        { label: 'transition', insertText: 'transition: ${1:all} ${2:0.3s} ${3:ease};', kind: CompletionKind.Snippet, detail: 'Transition' },
        { label: 'media query', insertText: '@media (max-width: ${1:768px}) {\n\t$2\n}', kind: CompletionKind.Snippet, detail: 'Responsive breakpoint' },
      ],
    };

    return languageSnippets[language] || languageSnippets.javascript;
  }

  private cacheCompletions(key: string, suggestions: CompletionItem[]): void {
    if (this.completionCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.completionCache.keys().next().value;
      if (oldestKey) {
        this.completionCache.delete(oldestKey);
      }
    }
    this.completionCache.set(key, { suggestions, timestamp: Date.now() });
  }

  private updateMetrics(latencyMs: number): void {
    this.requestCount++;
    this.totalLatency += latencyMs;
  }

  getMetrics(): { requestCount: number; averageLatencyMs: number } {
    return {
      requestCount: this.requestCount,
      averageLatencyMs: this.requestCount > 0 ? this.totalLatency / this.requestCount : 0,
    };
  }

  clearCache(): void {
    this.completionCache.clear();
    console.log('[CODE-COMPLETION] Cache cleared');
  }
}

export const codeCompletionService = new CodeCompletionService();
