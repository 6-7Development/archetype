import { useState } from "react";
import { MessageSquare, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandConsole } from "@/components/command-console";
import { AIChat } from "@/components/ai-chat";
import { cn } from "@/lib/utils";

type InteractionMode = "talk" | "build";

interface WorkspaceInteractionProps {
  onProjectGenerated?: (result: any) => void;
}

export function WorkspaceInteraction({ onProjectGenerated }: WorkspaceInteractionProps) {
  const [mode, setMode] = useState<InteractionMode>("build");

  return (
    <div className="flex flex-col h-full">
      {/* Mode Toggle */}
      <div className="flex items-center gap-1 p-2 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <Button
          variant={mode === "talk" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("talk")}
          className={cn(
            "flex-1 gap-2",
            mode === "talk" && "shadow-sm"
          )}
          data-testid="button-mode-talk"
        >
          <MessageSquare className="w-4 h-4" />
          Talk
        </Button>
        <Button
          variant={mode === "build" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("build")}
          className={cn(
            "flex-1 gap-2",
            mode === "build" && "shadow-sm"
          )}
          data-testid="button-mode-build"
        >
          <Terminal className="w-4 h-4" />
          Build
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {mode === "talk" ? (
          <AIChat onProjectGenerated={onProjectGenerated} />
        ) : (
          <CommandConsole onProjectGenerated={onProjectGenerated} viewMode="desktop" />
        )}
      </div>
    </div>
  );
}
