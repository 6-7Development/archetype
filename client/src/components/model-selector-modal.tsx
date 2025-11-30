import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Brain, Sparkles } from 'lucide-react';

interface ModelSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentModel?: string;
  onModelSelect: (model: string) => void;
}

const MODELS = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    icon: Zap,
    description: 'Fast, cost-effective. Best for rapid development.',
    costPerMT: '$0.075 input / $0.30 output',
    speed: '⚡ Very Fast',
    recommended: true,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    icon: Sparkles,
    description: 'Multi-modal. Best for visual analysis.',
    costPerMT: '$10.00 input / $30.00 output',
    speed: '✨ Powerful',
    recommended: false,
  },
];

export function ModelSelectorModal({
  open,
  onOpenChange,
  currentModel = 'gemini-2.5-flash',
  onModelSelect,
}: ModelSelectorModalProps) {
  const [selected, setSelected] = useState(currentModel);

  const handleSelect = () => {
    onModelSelect(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose AI Model</DialogTitle>
          <DialogDescription>
            Select the model that best fits your task. Each has different speeds, costs, and capabilities.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          {MODELS.map((model) => {
            const Icon = model.icon;
            const isSelected = selected === model.id;

            return (
              <button
                key={model.id}
                onClick={() => setSelected(model.id)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  isSelected
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                    : 'border-border hover:border-[hsl(var(--primary))]/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 text-[hsl(var(--primary))] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{model.name}</h3>
                      {model.recommended && (
                        <Badge variant="default" className="text-xs">
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-muted-foreground">{model.costPerMT}</span>
                      <span className="text-muted-foreground">{model.speed}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect}>
            Use {MODELS.find(m => m.id === selected)?.name}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
