import { Activity, Zap, HardDrive } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function ResourcesMonitor() {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        System Resources
      </h3>

      <div className="space-y-4">
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Zap className="w-3 h-3" />
              CPU Usage
            </div>
            <span className="text-xs font-mono">45%</span>
          </div>
          <Progress value={45} className="h-2" />
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <HardDrive className="w-3 h-3" />
              Memory Usage
            </div>
            <span className="text-xs font-mono">62%</span>
          </div>
          <Progress value={62} className="h-2" />
        </Card>

        <Card className="p-3 bg-muted/50">
          <div className="text-xs space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Uptime</span>
              <span>12h 34m</span>
            </div>
            <div className="flex justify-between">
              <span>Requests</span>
              <span>1,247</span>
            </div>
            <div className="flex justify-between">
              <span>Errors</span>
              <span className="text-green-600">0</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
