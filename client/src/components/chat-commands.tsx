import { Command, Zap, Code2, GitBranch, FileText, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function ChatCommands() {
  const commands = [
    { icon: Code2, label: 'Refactor Code', desc: 'Clean up and optimize' },
    { icon: GitBranch, label: 'Git Commands', desc: 'Commit, push, pull' },
    { icon: FileText, label: 'Explain Code', desc: 'Understand logic' },
    { icon: Play, label: 'Debug', desc: 'Find and fix bugs' },
    { icon: Zap, label: 'Generate Tests', desc: 'Write test cases' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
        <Command className="w-4 h-4" />
        Quick Commands
      </h3>

      <div className="space-y-2 flex-1 overflow-y-auto">
        {commands.map((cmd) => (
          <Card
            key={cmd.label}
            className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Button variant="ghost" className="w-full justify-start h-auto p-0" data-testid={`button-cmd-${cmd.label.toLowerCase().replace(' ', '-')}`}>
              <div className="flex items-start gap-3 w-full">
                <cmd.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-semibold">{cmd.label}</div>
                  <div className="text-xs text-muted-foreground">{cmd.desc}</div>
                </div>
              </div>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
