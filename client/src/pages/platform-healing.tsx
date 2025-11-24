import { UniversalChat } from '@/components/universal-chat';
import { WorkspaceLayout } from '@/components/workspace-layout';
import { useQuery } from "@tanstack/react-query";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Beaker } from 'lucide-react';

export default function PlatformHealing() {
  const [testMode, setTestMode] = useState(false);
  
  // LomuAI always uses Gemini (cost-effective). 
  // I AM Architect is an internal advisor - automatically consulted when LomuAI detects it's stuck
  const targetContext: 'platform' | 'architect' = 'platform';
  
  return (
    <WorkspaceLayout
      projectId={testMode ? "test-project" : "platform-healing"}
      projectName={testMode ? "Test LomuAI" : "Platform Healing"}
      mode={testMode ? "workspace" : "platform-healing"}
      isAdmin={true}
      userRole="owner"
    >
      <div className="h-full w-full overflow-hidden flex flex-col">
        {/* Header with Test Toggle */}
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {testMode ? '🧪 Test Mode' : '⚙️ Platform Healing'}
            </span>
          </div>
          <Button
            size="sm"
            variant={testMode ? "default" : "outline"}
            onClick={() => setTestMode(!testMode)}
            className="text-xs gap-2"
            data-testid="button-toggle-test-mode"
          >
            <Beaker className="w-3.5 h-3.5" />
            {testMode ? 'Back to Healing' : 'Test LomuAI'}
          </Button>
        </div>

        {/* Chat/IDE Content */}
        <div className="flex-1 overflow-hidden">
          <UniversalChat 
            targetContext={targetContext}
            projectId={testMode ? "test-project" : null}
            isTestMode={testMode}
          />
        </div>
      </div>
    </WorkspaceLayout>
  );
}
