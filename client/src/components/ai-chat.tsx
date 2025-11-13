import { UniversalChat } from './universal-chat';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface AIChatProps {
  onProjectGenerated?: (result: any) => void;
  currentProjectId?: string | null;
}

export function AIChat({ onProjectGenerated, currentProjectId }: AIChatProps) {
  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="chat-no-project-message">
        <Card className="p-6 max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-0">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">No Project Selected</h3>
              <p className="text-muted-foreground text-sm">
                Please create or select a project to start chatting with LomuAI.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <UniversalChat 
      targetContext="project"
      projectId={currentProjectId}
      onProjectGenerated={onProjectGenerated}
    />
  );
}
