import { Button } from "@/components/ui/button";
import { Paperclip, Image as ImageIcon, FileText, Archive, FileCode, Upload } from "lucide-react";
import { useRef } from "react";

interface ChatInputToolbarProps {
  onImageSelect?: (files: FileList) => void;
  onFileSelect?: (files: FileList) => void;
  disabled?: boolean;
}

export function ChatInputToolbar({ onImageSelect, onFileSelect, disabled }: ChatInputToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onImageSelect) {
      onImageSelect(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFileSelect) {
      onFileSelect(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  // Supported file types for documents, projects, code files, and archives
  const acceptedFileTypes = ".pdf,.doc,.docx,.txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.rb,.go,.rs,.php,.html,.css,.scss,.sass,.xml,.yaml,.yml,.toml,.ini,.conf,.sh,.bash,.zsh,.fish,.ps1,.bat,.cmd,.zip,.rar,.7z,.tar,.gz,.bz2,.xz";

  return (
    <div className="flex items-center gap-1">
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageChange}
        data-testid="input-image-upload"
      />
      
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFileTypes}
        multiple
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-file-upload"
      />
      
      {/* Upload button for all file types */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleFileClick}
        disabled={disabled}
        className="h-9 w-9 text-muted-foreground hover:text-foreground"
        data-testid="button-attach-file"
        title="Attach files (documents, code, archives)"
      >
        <Upload className="h-4 w-4" />
      </Button>

      {/* Image button (keep existing) */}
      {onImageSelect && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleImageClick}
          disabled={disabled}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          data-testid="button-attach-image"
          title="Attach image"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}