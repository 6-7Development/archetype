import { Editor, OnChange } from "@monaco-editor/react";
import { useTheme } from "@/components/theme-provider";
import { Loader2 } from "lucide-react";

interface MonacoEditorProps {
  value: string;
  onChange: OnChange;
  language: string;
  readOnly?: boolean;
  compact?: boolean;
}

export function MonacoEditor({ value, onChange, language, readOnly = false, compact = false }: MonacoEditorProps) {
  const { theme } = useTheme();

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onChange={onChange}
      theme={theme === "dark" ? "vs-dark" : "light"}
      options={{
        minimap: { enabled: !compact },
        fontSize: compact ? 13 : 14,
        lineNumbers: "on",
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: "on",
        fontFamily: "var(--font-mono)",
        padding: { top: compact ? 8 : 16, bottom: compact ? 8 : 16 },
      }}
      loading={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    />
  );
}
