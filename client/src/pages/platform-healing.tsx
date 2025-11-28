import { UniversalChat } from '@/components/universal-chat';
import { WorkspaceLayout } from '@/components/workspace-layout';
import { useState } from 'react';
import { ProjectSelector } from '@/components/project-selector';
import { FolderOpen } from 'lucide-react';

export default function PlatformHealing() {
  // Project selector - determines which workspace is active
  const [selectedProject, setSelectedProject] = useState<string>('platform-healing');
  
  // Hexad always uses Gemini (cost-effective). 
  // I AM Architect is an internal advisor - automatically consulted when Hexad detects it's stuck
  const targetContext: 'platform' | 'architect' = 'platform';
  
  // Determine display info based on selected project
  const isTestProject = selectedProject === 'test-project';
  const projectName = isTestProject ? '🧪 Test Project' : '⚙️ Platform Healing';
  const mode = isTestProject ? 'workspace' : 'platform-healing';
  
  return (
    <WorkspaceLayout
      projectId={selectedProject}
      projectName={projectName}
      mode={mode}
      isAdmin={true}
      userRole="owner"
    >
      <div className="h-full w-full overflow-hidden flex flex-col">
        {/* Project Selector Header */}
        <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3 flex-shrink-0">
          <FolderOpen className="w-4 h-4 text-primary" />
          <ProjectSelector 
            projectId={selectedProject}
            onProjectChange={setSelectedProject}
          />
        </div>

        {/* Chat/IDE Content - Fully Isolated to Selected Project */}
        <div className="flex-1 overflow-hidden">
          <UniversalChat 
            targetContext={targetContext}
            projectId={selectedProject}
          />
        </div>
      </div>
    </WorkspaceLayout>
  );
}
