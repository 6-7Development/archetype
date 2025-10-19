import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Maximize2, Eye, EyeOff } from "lucide-react";

interface LivePreviewProps {
  files: Array<{
    filename: string;
    content: string;
    language: string;
  }>;
}

export function LivePreview({ files }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const renderPreview = () => {
    if (!iframeRef.current) return;

    // Find HTML file (or create default)
    let htmlFile = files.find(f => f.language === 'html' || f.filename.endsWith('.html'));
    let cssFiles = files.filter(f => f.language === 'css' || f.filename.endsWith('.css'));
    let jsFiles = files.filter(f => f.language === 'javascript' || f.language === 'typescript' || f.filename.endsWith('.js'));

    let htmlContent = htmlFile?.content || '<!DOCTYPE html><html><head></head><body></body></html>';

    // Inject CSS into <head>
    if (cssFiles.length > 0) {
      const cssContent = cssFiles.map(f => `<style>\n${f.content}\n</style>`).join('\n');
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `${cssContent}\n</head>`);
      } else {
        htmlContent = htmlContent.replace('<html>', `<html><head>${cssContent}</head>`);
      }
    }

    // Inject JavaScript before </body>
    if (jsFiles.length > 0) {
      const jsContent = jsFiles.map(f => `<script>\n${f.content}\n</script>`).join('\n');
      if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', `${jsContent}\n</body>`);
      } else {
        htmlContent = htmlContent + jsContent;
      }
    }

    // Write to iframe
    const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
    }
  };

  useEffect(() => {
    if (files && files.length > 0) {
      renderPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIframeKey(prev => prev + 1);
    setTimeout(() => {
      renderPreview();
      setIsRefreshing(false);
    }, 300);
  };

  const handleFullscreen = () => {
    if (iframeRef.current) {
      iframeRef.current.requestFullscreen();
    }
  };

  const openInNewTab = () => {
    // Create a new window with the bundled content
    let htmlFile = files.find(f => f.language === 'html' || f.filename.endsWith('.html'));
    let cssFiles = files.filter(f => f.language === 'css' || f.filename.endsWith('.css'));
    let jsFiles = files.filter(f => f.language === 'javascript' || f.language === 'typescript' || f.filename.endsWith('.js'));

    let htmlContent = htmlFile?.content || '<!DOCTYPE html><html><head></head><body></body></html>';

    if (cssFiles.length > 0) {
      const cssContent = cssFiles.map(f => `<style>\n${f.content}\n</style>`).join('\n');
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `${cssContent}\n</head>`);
      } else {
        htmlContent = htmlContent.replace('<html>', `<html><head>${cssContent}</head>`);
      }
    }

    if (jsFiles.length > 0) {
      const jsContent = jsFiles.map(f => `<script>\n${f.content}\n</script>`).join('\n');
      if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', `${jsContent}\n</body>`);
      } else {
        htmlContent = htmlContent + jsContent;
      }
    }

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Preview Controls */}
      <div className="h-14 border-b px-4 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Live Preview</span>
          <Badge variant="outline" className="text-xs border-primary/20">
            {files.length} files
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-preview-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={openInNewTab}
            data-testid="button-preview-new-tab"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="flex-1 p-4 overflow-hidden">
        <Card className="h-full overflow-hidden border-primary/10">
          <iframe
            key={iframeKey}
            ref={iframeRef}
            className="w-full h-full border-0 bg-white dark:bg-gray-900"
            sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
            title="Live Preview"
            data-testid="iframe-preview"
          />
        </Card>
      </div>
    </div>
  );
}
