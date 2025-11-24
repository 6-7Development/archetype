import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProjectSelectorProps {
  projectId: string;
  onProjectChange: (projectId: string) => void;
}

// Available projects - test-project and platform-healing
const AVAILABLE_PROJECTS = [
  { id: 'platform-healing', name: '⚙️ Platform Healing' },
  { id: 'test-project', name: '🧪 Test Project' },
];

export function ProjectSelector({ 
  projectId, 
  onProjectChange
}: ProjectSelectorProps) {
  const currentProject = AVAILABLE_PROJECTS.find(p => p.id === projectId);

  return (
    <div className="flex items-center gap-3 flex-1">
      <Select value={projectId} onValueChange={onProjectChange}>
        <SelectTrigger className="w-64 h-8 text-sm" data-testid="select-project">
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_PROJECTS.map((project) => (
            <SelectItem 
              key={project.id} 
              value={project.id}
              data-testid={`option-project-${project.id}`}
            >
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">
        {currentProject?.name || 'Select a project'}
      </span>
    </div>
  );
}
