import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Upload, FileArchive, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { UploadLoader } from "@/components/upload-loader";

export function ProjectUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const uploadMutation = useMutation({
    mutationFn: async (zipFile: File) => {
      const formData = new FormData();
      formData.append('file', zipFile);
      formData.append('projectName', zipFile.name.replace('.zip', ''));

      const response = await fetch('/api/import/zip', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // If response isn't JSON, try to get text
          const text = await response.text();
          errorMessage = text || `Upload failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Complete progress
      setUploadProgress(100);
      
      toast({
        title: "Project Imported!",
        description: `${data.importedCount} files imported successfully`,
      });
      
      // Invalidate projects cache and redirect to builder with new project
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setTimeout(() => {
        setFile(null);
        setUploadProgress(0);
        setLocation(`/builder/${data.project.id}`);
      }, 1000); // Brief delay to show success message
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  // Simulate progress during upload
  useEffect(() => {
    if (uploadMutation.isPending) {
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);
      
      return () => clearInterval(interval);
    }
  }, [uploadMutation.isPending]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.zip')) {
      setFile(droppedFile);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a .zip file",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.zip')) {
        setFile(selectedFile);
      } else {
        toast({
          title: "Invalid File",
          description: "Please upload a .zip file",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = () => {
    if (file) {
      setUploadProgress(10);
      uploadMutation.mutate(file);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <UploadLoader isOpen={uploadMutation.isPending} progress={uploadProgress} />
      
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Import Existing Project</h3>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Upload a ZIP file of your project to continue working on it with BeeHive AI
          </p>

        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer hover-elevate",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            )}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-upload"
          >
            <Upload className={cn(
              "w-12 h-12 mx-auto mb-4",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
            <p className="text-sm font-medium mb-1">
              {isDragging ? "Drop your ZIP file here" : "Click to upload or drag and drop"}
            </p>
            <p className="text-xs text-muted-foreground">
              .zip files only (max 100MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileArchive className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              {uploadMutation.isSuccess ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveFile}
                  disabled={uploadMutation.isPending}
                  data-testid="button-remove-file"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {uploadMutation.isPending && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Uploading and extracting files...
                </p>
              </div>
            )}

            {!uploadMutation.isSuccess && (
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="w-full"
                data-testid="button-upload"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Project
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
    </>
  );
}
