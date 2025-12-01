import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Check, Link, QrCode, Clock, Shield, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface QuickShareProps {
  projectId: string;
  projectName?: string;
  className?: string;
}

interface ShareLink {
  id: string;
  url: string;
  shortCode: string;
  expiresAt: string | null;
  accessCount: number;
  isPublic: boolean;
}

export function QuickShare({ projectId, projectName, className }: QuickShareProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState<'1h' | '24h' | '7d' | 'never'>('24h');
  const [isPublic, setIsPublic] = useState(true);
  const { toast } = useToast();

  const createShareMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/share', {
        projectId,
        expiresIn,
        isPublic
      });
      return response.json();
    },
    onSuccess: (data) => {
      setShareLink(data);
      toast({
        title: "Share link created",
        description: "Your project is now shareable",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create share link",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleCopy = useCallback(() => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Share link copied to clipboard",
      });
    }
  }, [shareLink, toast]);

  const getExpiryLabel = (exp: typeof expiresIn) => {
    switch (exp) {
      case '1h': return '1 hour';
      case '24h': return '24 hours';
      case '7d': return '7 days';
      case 'never': return 'Never';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
          data-testid="button-quick-share"
        >
          <Share2 className="w-4 h-4" />
          Quick Share
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share Project
          </DialogTitle>
          <DialogDescription>
            Create a shareable link for {projectName || 'this project'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Expiry Options */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Link expires in
            </label>
            <div className="flex gap-2">
              {(['1h', '24h', '7d', 'never'] as const).map((exp) => (
                <Button
                  key={exp}
                  size="sm"
                  variant={expiresIn === exp ? "default" : "outline"}
                  onClick={() => setExpiresIn(exp)}
                  className="flex-1"
                  data-testid={`button-expiry-${exp}`}
                >
                  {getExpiryLabel(exp)}
                </Button>
              ))}
            </div>
          </div>

          {/* Privacy Options */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Access level
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={isPublic ? "default" : "outline"}
                onClick={() => setIsPublic(true)}
                className="flex-1"
                data-testid="button-public"
              >
                Public (anyone with link)
              </Button>
              <Button
                size="sm"
                variant={!isPublic ? "default" : "outline"}
                onClick={() => setIsPublic(false)}
                className="flex-1"
                data-testid="button-private"
              >
                Private (login required)
              </Button>
            </div>
          </div>

          {/* Generate Button */}
          <Button 
            className="w-full" 
            onClick={() => createShareMutation.mutate()}
            disabled={createShareMutation.isPending}
            data-testid="button-generate-link"
          >
            {createShareMutation.isPending ? (
              <>Generating...</>
            ) : (
              <>
                <Link className="w-4 h-4 mr-2" />
                Generate Share Link
              </>
            )}
          </Button>

          {/* Share Link Result */}
          <AnimatePresence mode="wait">
            {shareLink && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={shareLink.url}
                    readOnly
                    className="font-mono text-sm"
                    data-testid="input-share-url"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopy}
                    data-testid="button-copy-share-link"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => window.open(shareLink.url, '_blank')}
                    data-testid="button-open-share-link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {shareLink.isPublic ? 'Public' : 'Private'}
                  </Badge>
                  {shareLink.expiresAt && (
                    <Badge variant="outline" className="text-xs">
                      Expires: {new Date(shareLink.expiresAt).toLocaleDateString()}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {shareLink.accessCount} views
                  </Badge>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
