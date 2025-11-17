import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AgentTaskList, type AgentTask } from "@/components/agent-task-list";
import { RunProgressTable } from "@/components/run-progress-table";
import { ArtifactsDrawer, type Artifact as ArtifactItem } from "@/components/agent/ArtifactsDrawer";
import { ArchitectNotesPanel } from "@/components/architect-notes-panel";
import { StatusStrip } from "@/components/agent/StatusStrip";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ListTodo, Activity, FileCode, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunState } from "@shared/agentEvents";

interface ContextRailProps {
  tasks: AgentTask[];
  artifacts: ArtifactItem[];
  runState: RunState | null;
  onTaskClick?: (taskId: string) => void;
  onArtifactView?: (artifact: ArtifactItem) => void;
  className?: string;
}

export function ContextRail({
  tasks,
  artifacts,
  runState,
  onTaskClick,
  onArtifactView,
  className
}: ContextRailProps) {
  const [openSections, setOpenSections] = useState<string[]>(["tasks"]);

  const hasTasks = tasks && tasks.length > 0;
  const hasArtifacts = artifacts && artifacts.length > 0;
  const hasProgress = runState && runState.status === 'active';

  return (
    <aside 
      className={cn(
        "flex flex-col h-full overflow-hidden border-l bg-muted/20",
        className
      )}
      data-testid="context-rail"
    >
      <div className="flex-1 overflow-y-auto">
        <Accordion 
          type="multiple" 
          value={openSections}
          onValueChange={setOpenSections}
          className="w-full"
        >
          {hasTasks && (
            <AccordionItem value="tasks" className="border-b">
              <AccordionTrigger 
                className="px-4 py-3 hover:bg-accent/50"
                data-testid="accordion-tasks"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ListTodo className="h-4 w-4" />
                  <span>Tasks</span>
                  <Badge variant="secondary" className="ml-auto mr-2">
                    {tasks.filter(t => t.status === 'completed').length}/{tasks.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <AgentTaskList 
                  tasks={tasks}
                  onTaskClick={onTaskClick}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {hasProgress && (
            <AccordionItem value="progress" className="border-b">
              <AccordionTrigger 
                className="px-4 py-3 hover:bg-accent/50"
                data-testid="accordion-progress"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span>Execution</span>
                  <Badge variant="outline" className="ml-auto mr-2">
                    {runState.metrics.currentIteration}/{runState.metrics.maxIterations}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  <StatusStrip phase={runState.phase} />
                  <RunProgressTable runState={runState} />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {hasArtifacts && (
            <AccordionItem value="artifacts" className="border-b">
              <AccordionTrigger 
                className="px-4 py-3 hover:bg-accent/50"
                data-testid="accordion-artifacts"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileCode className="h-4 w-4 text-purple-500" />
                  <span>Artifacts</span>
                  <Badge variant="secondary" className="ml-auto mr-2">
                    {artifacts.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2">
                  {artifacts.map((artifact, idx) => (
                    <Card
                      key={idx}
                      className="p-3 cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => onArtifactView?.(artifact)}
                      data-testid={`artifact-${idx}`}
                    >
                      <div className="flex items-start gap-2">
                        <FileCode className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{artifact.path}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {artifact.type} • {artifact.size ? `${(artifact.size / 1024).toFixed(1)}KB` : '-'}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="notes" className="border-b-0">
            <AccordionTrigger 
              className="px-4 py-3 hover:bg-accent/50"
              data-testid="accordion-notes"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <StickyNote className="h-4 w-4 text-amber-500" />
                <span>Architect Notes</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <ArchitectNotesPanel projectId={null} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </aside>
  );
}
