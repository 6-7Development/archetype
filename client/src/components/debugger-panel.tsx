import { Bug, Pause, Play, StepForward, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

export function DebuggerPanel() {
  const [isDebugging, setIsDebugging] = useState(false);
  const [breakpoints] = useState([
    { file: 'App.tsx', line: 42 },
    { file: 'utils.ts', line: 15 },
  ]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <Tabs defaultValue="variables" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="breakpoints">Breakpoints</TabsTrigger>
          <TabsTrigger value="watch">Watch</TabsTrigger>
        </TabsList>

        <div className="flex gap-2 my-3">
          <Button size="sm" variant={isDebugging ? 'default' : 'outline'} onClick={() => setIsDebugging(!isDebugging)}>
            {isDebugging ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
            {isDebugging ? 'Pause' : 'Start'}
          </Button>
          <Button size="sm" variant="outline" disabled={!isDebugging}>
            <StepForward className="w-3 h-3 mr-1" />
            Step
          </Button>
          <Button size="sm" variant="outline" disabled={!isDebugging}>
            <RotateCcw className="w-3 h-3 mr-1" />
            Restart
          </Button>
        </div>

        <TabsContent value="variables" className="flex-1 overflow-auto space-y-2">
          {isDebugging ? (
            <>
              <Card className="p-2">
                <div className="text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>user</span>
                    <span className="text-muted-foreground">Object</span>
                  </div>
                  <div className="flex justify-between">
                    <span>count</span>
                    <span className="text-blue-600">42</span>
                  </div>
                  <div className="flex justify-between">
                    <span>loading</span>
                    <span className="text-green-600">true</span>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Start debugging to inspect variables</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="breakpoints" className="flex-1 overflow-auto space-y-2">
          {breakpoints.map((bp, i) => (
            <Card key={i} className="p-2 flex items-center justify-between">
              <div className="text-xs">
                <div className="font-mono font-semibold">{bp.file}</div>
                <div className="text-muted-foreground">Line {bp.line}</div>
              </div>
              <Button size="sm" variant="ghost" className="h-6 text-destructive">
                <Trash2 className="w-3 h-3" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="watch" className="flex-1 overflow-auto">
          <Card className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Add expressions to watch</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
