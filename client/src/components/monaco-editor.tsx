import { Editor, OnChange } from "@monaco-editor/react";
import { useTheme } from "@/components/theme-provider";
import { Loader2 } from "lucide-react";

interface MonacoEditorProps {
  value: string;
  onChange: OnChange;
  language: string;
  readOnly?: boolean;
  compact?: boolean;
  showMinimap?: boolean;
  fontSize?: number;
  tabSize?: number;
  wordWrap?: boolean;
}

export function MonacoEditor({ 
  value, 
  onChange, 
  language, 
  readOnly = false, 
  compact = false,
  showMinimap = true,
  fontSize,
  tabSize = 2,
  wordWrap = true,
}: MonacoEditorProps) {
  const { theme } = useTheme();

  const effectiveFontSize = fontSize ?? (compact ? 13 : 14);
  const effectiveMinimap = compact ? false : showMinimap;

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onChange={onChange}
      theme={theme === "dark" ? "vs-dark" : "light"}
      options={{
        minimap: { 
          enabled: effectiveMinimap,
          scale: 1,
          showSlider: 'mouseover',
        },
        fontSize: effectiveFontSize,
        lineNumbers: "on",
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly,
        automaticLayout: true,
        tabSize,
        wordWrap: wordWrap ? "on" : "off",
        fontFamily: "var(--font-mono)",
        padding: { top: compact ? 8 : 16, bottom: compact ? 8 : 16 },
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
      }}
      loading={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
      onMount={(editor) => {
        console.log('✅ [MONACO] Editor mounted successfully');
      }}
    />
  );
}
