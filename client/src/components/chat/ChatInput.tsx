import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChatInputToolbar } from "@/components/ui/chat-input-toolbar";
import { Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ScoutLoadingIcon } from "@/components/scout-loading-icon";
import { cn } from "@/lib/utils";

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
              <div className="h-20 w-20 rounded border border-border bg-card flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[hsl(220,70%,60%)]" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
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
                className="h-20 w-20 object-cover rounded border border-border"
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
            placeholder={isGenerating ? "" : "Message BeeHive..."}
            className="min-h-[50px] md:min-h-[56px] max-h-[180px] resize-none text-base md:text-lg bg-background/80 border border-border/70 focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:border-primary/50 rounded-lg px-3 md:px-4 py-2.5 md:py-3 pr-10 transition-all"
            disabled={isGenerating}
            data-testid="input-chat-message"
            rows={2}
          />
          {/* Scout bee icon - inline while generating */}
          {isGenerating && (
            <div className="absolute inset-0 flex items-center px-3 md:px-4 py-2.5 md:py-3 pointer-events-none">
              <ScoutLoadingIcon />
            </div>
          )}
          <div className="absolute bottom-2.5 right-2.5">
            <ChatInputToolbar
              onImageSelect={onImageSelect}
              disabled={isGenerating}
            />
          </div>
        </div>
        <motion.div
          whileTap={{ scale: 0.92 }}
          transition={{ duration: 0.1 }}
        >
          <Button
            onClick={onSend}
            disabled={!input.trim() || isGenerating}
            size="icon"
            variant="default"
            className={cn(
              "flex-shrink-0 h-10 w-10 rounded-lg transition-all",
              input.trim() && !isGenerating && "honeycomb-pulse hover-glow"
            )}
            data-testid="button-send-chat"
          >
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, rotate: 0 }}
                  animate={{ opacity: 1, rotate: 360 }}
                  exit={{ opacity: 0 }}
                  transition={{ rotate: { duration: 1, repeat: Infinity, ease: "linear" } }}
                >
                  <Loader2 className="w-4 h-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="send"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Send className="w-4 h-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
