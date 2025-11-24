import { FileText, Play, Zap, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ChatSidebar() {
  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Tabs defaultValue="context" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 rounded-none bg-card border-b">
          <TabsTrigger value="context" className="rounded-none text-xs" data-testid="tab-context">
            <FileText className="w-3 h-3 mr-1" />
            Context
          </TabsTrigger>
          <TabsTrigger value="output" className="rounded-none text-xs" data-testid="tab-output">
            <Zap className="w-3 h-3 mr-1" />
            Output
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="rounded-none text-xs" data-testid="tab-suggestions">
            <MessageSquare className="w-3 h-3 mr-1" />
            Suggest
          </TabsTrigger>
        </TabsList>

        <TabsContent value="context" className="flex-1 overflow-auto space-y-2 p-3">
          <Card className="p-3">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
              <FileText className="w-3 h-3" />
              Project Files
            </h4>
            <div className="text-xs space-y-2 text-muted-foreground">
              <div className="hover:text-foreground cursor-pointer">
                <div className="font-mono font-semibold text-xs">App.tsx</div>
              </div>
              <div className="hover:text-foreground cursor-pointer">
                <div className="font-mono font-semibold text-xs">workspace-layout.tsx</div>
              </div>
              <Button size="sm" variant="outline" className="w-full mt-3 h-6 text-xs" data-testid="button-add-files">
                <FileText className="w-3 h-3 mr-1" />
                Add Files
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="output" className="flex-1 overflow-auto space-y-2 p-3">
          <Card className="p-3 bg-muted/30">
            <h4 className="text-xs font-semibold mb-2">Build Output</h4>
            <div className="font-mono text-xs space-y-1 text-muted-foreground">
              <div>{'>'} npm run dev</div>
              <div className="text-green-600">✓ Server ready on :5000</div>
              <div className="text-green-600">✓ Database connected</div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="flex-1 overflow-auto space-y-2 p-3">
          <Card className="p-3 hover:bg-primary/5 cursor-pointer transition-colors">
            <div className="text-xs space-y-1">
              <div className="font-semibold">Refactor Pattern</div>
              <div className="text-muted-foreground text-xs">Extract component logic</div>
            </div>
          </Card>
          <Card className="p-3 hover:bg-primary/5 cursor-pointer transition-colors">
            <div className="text-xs space-y-1">
              <div className="font-semibold">Error Handling</div>
              <div className="text-muted-foreground text-xs">Add try-catch block</div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="border-t bg-card p-2 space-y-2">
        <Button size="sm" className="w-full h-7 text-xs" data-testid="button-run-code">
          <Play className="w-3 h-3 mr-1" />
          Run
        </Button>
      </div>
    </div>
  );
}
