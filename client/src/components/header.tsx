import { Menu, ChevronRight, HelpCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  projectName: string;
  onSidebarToggle?: () => void;
}

export function Header({ projectName, onSidebarToggle }: HeaderProps) {
  return (
    <header className="border-b bg-card/50 backdrop-blur-sm px-4 py-3 flex items-center justify-between h-14">
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={onSidebarToggle}
          className="h-6 w-6 p-0"
          data-testid="button-toggle-chat-sidebar"
        >
          <Menu className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-sm">{projectName}</h1>
          <Badge variant="outline" className="text-xs">
            Beta
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          data-testid="button-help"
        >
          <HelpCircle className="w-3 h-3 mr-1" />
          Help
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          data-testid="button-header-settings"
        >
          <Settings className="w-3 h-3 mr-1" />
          Settings
        </Button>
      </div>
    </header>
  );
}
