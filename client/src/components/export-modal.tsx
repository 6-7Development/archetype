/**
 * Export Modal Component
 * 
 * Allows users to export chat conversations and code snippets as Markdown or JSON
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileText, Code, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  projectId?: string;
}

export function ExportModal({ isOpen, onClose, sessionId, projectId }: ExportModalProps) {
  const [exportType, setExportType] = useState<'chat' | 'code'>('chat');
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown');
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const endpoint = exportType === 'chat' ? '/api/exports/chat' : '/api/exports/code';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          projectId,
          format,
          includeTimestamps,
          includeMetadata,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = `export-${Date.now()}.${format === 'markdown' ? 'md' : 'json'}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) {
          fileName = match[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      toast({
        title: 'Export successful',
        description: `Your ${exportType} has been exported as ${format.toUpperCase()}`,
        variant: 'success',
      });

      // Close modal after short delay
      setTimeout(() => {
        onClose();
        setExportSuccess(false);
      }, 1500);

    } catch (error: any) {
      console.error('[EXPORT] Error:', error);
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-export">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-honey" />
            Export Conversation
          </DialogTitle>
          <DialogDescription>
            Download your chat history or code snippets
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">What to export</Label>
            <RadioGroup
              value={exportType}
              onValueChange={(v) => setExportType(v as 'chat' | 'code')}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="chat"
                  id="export-chat"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="export-chat"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-honey [&:has([data-state=checked])]:border-honey cursor-pointer"
                >
                  <FileText className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Full Chat</span>
                  <span className="text-xs text-muted-foreground">Messages & responses</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="code"
                  id="export-code"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="export-code"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-honey [&:has([data-state=checked])]:border-honey cursor-pointer"
                >
                  <Code className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Code Only</span>
                  <span className="text-xs text-muted-foreground">Code snippets</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as 'markdown' | 'json')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="markdown" id="format-md" />
                <Label htmlFor="format-md" className="cursor-pointer">Markdown (.md)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="format-json" />
                <Label htmlFor="format-json" className="cursor-pointer">JSON (.json)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Options</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="timestamps"
                  checked={includeTimestamps}
                  onCheckedChange={(checked) => setIncludeTimestamps(checked as boolean)}
                  data-testid="checkbox-timestamps"
                />
                <Label htmlFor="timestamps" className="text-sm cursor-pointer">
                  Include timestamps
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="metadata"
                  checked={includeMetadata}
                  onCheckedChange={(checked) => setIncludeMetadata(checked as boolean)}
                  data-testid="checkbox-metadata"
                />
                <Label htmlFor="metadata" className="text-sm cursor-pointer">
                  Include metadata (IDs, project info)
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-export-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-honey text-charcoal hover:bg-honey/90"
            data-testid="button-export-download"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : exportSuccess ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Downloaded!
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportModal;
