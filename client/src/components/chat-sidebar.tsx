import { FileText, Play, Zap, Settings, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export function ChatSidebar() {
  return (
    <div className="w-80 border-r bg-card/50 flex flex-col overflow-hidden">
      <Tabs defaultValue="context" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 rounded-none">
          <TabsTrigger value="context" className="rounded-none text-xs">
            <FileText className="w-3 h-3 mr-1" />
            Context
          </TabsTrigger>
          <TabsTrigger value="output" className="rounded-none text-xs">
            <Zap className="w-3 h-3 mr-1" />
            Output
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="rounded-none text-xs">
            <MessageSquare className="w-3 h-3 mr-1" />
            Suggestions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="context" className="flex-1 overflow-auto space-y-2 p-3">
          <Card className="p-3">
            <h4 className="text-xs font-semibold mb-2">Current Context</h4>
            <div className="text-xs space-y-2 text-muted-foreground">
              <div>
                <div className="font-mono font-semibold">App.tsx</div>
                <div className="text-xs">Main application entry point</div>
              </div>
              <div>
                <div className="font-mono font-semibold">workspace-layout.tsx</div>
                <div className="text-xs">IDE workspace structure</div>
              </div>
              <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs">
                <FileText className="w-3 h-3 mr-1" />
                Add Files
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="output" className="flex-1 overflow-auto space-y-2 p-3">
          <Card className="p-3 bg-background/50">
            <h4 className="text-xs font-semibold mb-2">Execution Output</h4>
            <div className="font-mono text-xs space-y-1 text-muted-foreground max-h-40 overflow-auto">
              <div>{'>'} npm run dev</div>
              <div>✓ Server started on port 5000</div>
              <div>✓ Database connected</div>
              <div className="text-green-600">Ready for development</div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="flex-1 overflow-auto space-y-2 p-3">
          <Card className="p-3">
            <h4 className="text-xs font-semibold mb-2">Code Suggestions</h4>
            <div className="space-y-2 text-xs">
              <div className="border rounded p-2 bg-primary/5 cursor-pointer hover:bg-primary/10">
                <div className="font-mono">useEffect optimization</div>
                <div className="text-muted-foreground text-xs">Add dependency array</div>
              </div>
              <div className="border rounded p-2 bg-primary/5 cursor-pointer hover:bg-primary/10">
                <div className="font-mono">Error handling</div>
                <div className="text-muted-foreground text-xs">Wrap async call in try-catch</div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="border-t p-3 space-y-2">
        <Button size="sm" className="w-full" data-testid="button-run-code">
          <Play className="w-3 h-3 mr-1" />
          Run Code
        </Button>
        <Button size="sm" variant="outline" className="w-full" data-testid="button-chat-settings">
          <Settings className="w-3 h-3 mr-1" />
          Settings
        </Button>
      </div>
    </div>
  );
}
