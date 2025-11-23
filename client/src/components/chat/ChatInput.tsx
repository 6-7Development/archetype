import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChatInputToolbar } from "@/components/ui/chat-input-toolbar";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onImageSelect: (files: FileList | null) => void;
  pendingImages: string[];
  uploadingImages: Map<string, boolean>;
  onRemoveImage: (imageUrl: string) => void;
  isGenerating: boolean;
}

export function ChatInput({
  input,
  setInput,
  onSend,
  onKeyDown,
  onPaste,
  onImageSelect,
  pendingImages,
  uploadingImages,
  onRemoveImage,
  isGenerating,
}: ChatInputProps) {
  return (
    <div className="border-t border-border/50 bg-background/50 backdrop-blur-sm px-4 py-3" data-testid="chat-input-container">
      {/* Image Preview Section */}
      {(pendingImages.length > 0 || uploadingImages.size > 0) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {Array.from(uploadingImages.keys()).map((tempId) => (
            <div key={tempId} className="relative">
              <div className="h-20 w-20 rounded border border-[hsl(220,15%,28%)] bg-[hsl(220,18%,16%)] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[hsl(220,70%,60%)]" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-[hsl(220,12%,55%)] bg-[hsl(220,20%,12%)]/80 px-2 py-1 rounded">
                  Uploading...
                </span>
              </div>
            </div>
          ))}

          {pendingImages.map((imageUrl, index) => (
            <div key={index} className="relative group">
              <img
                src={imageUrl}
                alt={`Preview ${index + 1}`}
                className="h-20 w-20 object-cover rounded border border-[hsl(220,15%,28%)]"
                data-testid={`image-preview-${index}`}
              />
              <button
                onClick={() => onRemoveImage(imageUrl)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-remove-image-${index}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder="Message LomuAI..."
            className="min-h-[44px] max-h-[150px] resize-none text-sm bg-background/80 border border-border/70 focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:border-primary/50 rounded-lg px-3 py-2.5 pr-10 transition-all"
            disabled={isGenerating}
            data-testid="input-chat-message"
            rows={2}
          />
          <div className="absolute bottom-2.5 right-2.5">
            <ChatInputToolbar
              onImageSelect={onImageSelect}
              disabled={isGenerating}
            />
          </div>
        </div>
        <Button
          onClick={onSend}
          disabled={!input.trim() || isGenerating}
          size="icon"
          variant="default"
          className="flex-shrink-0 h-10 w-10 rounded-lg hover:shadow-sm transition-all"
          data-testid="button-send-chat"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
