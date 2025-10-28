import { Button } from "@/components/ui/button";
import { Paperclip, Image as ImageIcon } from "lucide-react";
import { useRef } from "react";

interface ChatInputToolbarProps {
  onImageSelect: (files: FileList) => void;
  disabled?: boolean;
}

export function ChatInputToolbar({ onImageSelect, disabled }: ChatInputToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImageSelect(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-file-upload"
      />
      
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleFileClick}
        disabled={disabled}
        className="h-9 w-9 text-muted-foreground hover:text-foreground"
        data-testid="button-attach-image"
        title="Attach image"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
