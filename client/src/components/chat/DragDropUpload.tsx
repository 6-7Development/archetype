import { useState, useRef, useCallback } from 'react';
import { Upload, X, File, Image, FileCode, FileText, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface DragDropUploadProps {
  onFilesSelected: (files: File[]) => void;
  onFilesUploaded?: (urls: string[]) => void;
  onArtifactCreated?: (artifact: { name: string; path: string; type: string }) => void;
  projectId?: string;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxSizeBytes?: number;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  autoUpload?: boolean;
}

interface UploadedFile {
  file: File;
  preview?: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
  url?: string;
}

const FILE_ICONS: Record<string, typeof File> = {
  image: Image,
  code: FileCode,
  text: FileText,
  default: File,
};

function getFileCategory(mimeType: string): keyof typeof FILE_ICONS {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || 
      mimeType.includes('python') || mimeType.includes('json') ||
      mimeType.includes('html') || mimeType.includes('css')) return 'code';
  if (mimeType.startsWith('text/')) return 'text';
  return 'default';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DragDropUpload({
  onFilesSelected,
  onFilesUploaded,
  onArtifactCreated,
  projectId,
  acceptedTypes = ['image/*', 'text/*', 'application/json', 'application/javascript'],
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024,
  className,
  disabled = false,
  children,
  autoUpload = true,
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const dragCounter = useRef(0);

  const uploadFile = useCallback(async (file: File, index: number): Promise<string | null> => {
    try {
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, uploading: true } : f
      ));

      const formData = new FormData();
      formData.append('file', file);
      if (projectId) {
        formData.append('projectId', projectId);
      }

      const response = await fetch('/api/uploads/chat-file', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      const uploadedUrl = data.url || `/api/uploads/chat/${data.filename}`;

      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, uploading: false, uploaded: true, url: uploadedUrl } : f
      ));

      if (onArtifactCreated) {
        onArtifactCreated({
          name: data.originalName || file.name,
          path: uploadedUrl,
          type: data.mimeType || file.type,
        });
      }

      return uploadedUrl;
    } catch (error: any) {
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, uploading: false, error: error.message } : f
      ));
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [projectId, onArtifactCreated, toast]);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxSizeBytes) {
      return `File too large (max ${formatFileSize(maxSizeBytes)})`;
    }
    
    const isAccepted = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        const category = type.split('/')[0];
        return file.type.startsWith(category + '/');
      }
      return file.type === type;
    });
    
    if (!isAccepted && acceptedTypes.length > 0) {
      return 'File type not accepted';
    }
    
    return null;
  }, [acceptedTypes, maxSizeBytes]);

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: UploadedFile[] = [];
    const filesToProcess = Array.from(fileList).slice(0, maxFiles - files.length);
    
    for (const file of filesToProcess) {
      const error = validateFile(file);
      
      const uploadedFile: UploadedFile = {
        file,
        uploading: false,
        uploaded: false,
        error: error || undefined,
      };
      
      if (!error && file.type.startsWith('image/')) {
        uploadedFile.preview = URL.createObjectURL(file);
      }
      
      newFiles.push(uploadedFile);
    }
    
    if (newFiles.length > 0) {
      const startIndex = files.length;
      setFiles(prev => [...prev, ...newFiles]);
      const validFiles = newFiles.filter(f => !f.error).map(f => f.file);
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
        
        if (autoUpload) {
          const uploadPromises = validFiles.map((file, i) => 
            uploadFile(file, startIndex + i)
          );
          const uploadedUrls = await Promise.all(uploadPromises);
          const successfulUrls = uploadedUrls.filter((url): url is string => url !== null);
          if (successfulUrls.length > 0 && onFilesUploaded) {
            onFilesUploaded(successfulUrls);
          }
        }
      }
    }
    
    if (filesToProcess.length < Array.from(fileList).length) {
      toast({
        title: 'File limit reached',
        description: `Maximum ${maxFiles} files allowed`,
        variant: 'destructive',
      });
    }
  }, [files.length, maxFiles, validateFile, onFilesSelected, toast, autoUpload, uploadFile, onFilesUploaded]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    if (disabled) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  }, [disabled, processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => {
      const file = prev[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const openFilePicker = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const FileIcon = (category: keyof typeof FILE_ICONS) => FILE_ICONS[category] || FILE_ICONS.default;

  return (
    <div
      className={cn(
        "relative",
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-testid="drag-drop-upload-container"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
        data-testid="input-file-upload"
      />
      
      {/* Drag overlay */}
      {isDragging && (
        <div 
          className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm"
          data-testid="drag-overlay"
        >
          <div className="text-center">
            <Upload className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-primary">Drop files here</p>
            <p className="text-xs text-muted-foreground mt-1">
              Max {maxFiles} files, up to {formatFileSize(maxSizeBytes)} each
            </p>
          </div>
        </div>
      )}
      
      {children}
      
      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2" data-testid="file-previews">
          {files.map((file, index) => {
            const category = getFileCategory(file.file.type);
            const IconComponent = FileIcon(category);
            
            return (
              <div
                key={`${file.file.name}-${index}`}
                className={cn(
                  "relative group flex items-center gap-2 px-2 py-1.5 rounded-md border",
                  file.error ? "bg-destructive/10 border-destructive/50" : "bg-secondary/30 border-border",
                  file.uploading && "opacity-60"
                )}
                data-testid={`file-preview-${index}`}
              >
                {file.preview ? (
                  <img 
                    src={file.preview} 
                    alt={file.file.name}
                    className="w-8 h-8 object-cover rounded"
                  />
                ) : (
                  <IconComponent className="w-4 h-4 text-muted-foreground" />
                )}
                
                <div className="flex flex-col min-w-0 max-w-[120px]">
                  <span className="text-xs font-medium truncate">{file.file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {file.error || formatFileSize(file.file.size)}
                  </span>
                </div>
                
                {file.uploading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                ) : file.uploaded ? (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeFile(index)}
                    data-testid={`button-remove-file-${index}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Upload button (optional, can be hidden if using children) */}
      {!children && (
        <Button
          variant="outline"
          onClick={openFilePicker}
          disabled={disabled || files.length >= maxFiles}
          className="w-full"
          data-testid="button-upload-files"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Files ({files.length}/{maxFiles})
        </Button>
      )}
    </div>
  );
}

export function DragDropZone({
  onFilesSelected,
  acceptedTypes,
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024,
  disabled = false,
}: Omit<DragDropUploadProps, 'children' | 'className'>) {
  return (
    <DragDropUpload
      onFilesSelected={onFilesSelected}
      acceptedTypes={acceptedTypes}
      maxFiles={maxFiles}
      maxSizeBytes={maxSizeBytes}
      disabled={disabled}
      className="w-full"
    >
      <div 
        className={cn(
          "border-2 border-dashed border-border rounded-lg p-8 text-center transition-colors cursor-pointer hover:border-primary/50 hover:bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        data-testid="drag-drop-zone"
      >
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium">Drag & drop files here</p>
        <p className="text-xs text-muted-foreground mt-1">
          or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Max {maxFiles} files, up to {formatFileSize(maxSizeBytes)} each
        </p>
      </div>
    </DragDropUpload>
  );
}
