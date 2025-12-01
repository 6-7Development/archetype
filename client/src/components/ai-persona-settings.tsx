/**
 * AI Persona Settings - Customize Scout's personality and behavior
 * Users can define tone, expertise areas, and interaction style
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Save, RotateCcw, User, Brain, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AIPersona {
  name: string;
  tone: 'professional' | 'friendly' | 'concise' | 'detailed';
  expertise: string[];
  verbosity: number;
  customInstructions: string;
  showThinking: boolean;
  autoFix: boolean;
}

const DEFAULT_PERSONA: AIPersona = {
  name: 'Scout',
  tone: 'friendly',
  expertise: ['fullstack', 'react', 'typescript'],
  verbosity: 50,
  customInstructions: '',
  showThinking: true,
  autoFix: true,
};

const EXPERTISE_OPTIONS = [
  { id: 'fullstack', label: 'Full Stack', color: 'bg-purple-500/10 text-purple-600' },
  { id: 'frontend', label: 'Frontend', color: 'bg-blue-500/10 text-blue-600' },
  { id: 'backend', label: 'Backend', color: 'bg-green-500/10 text-green-600' },
  { id: 'react', label: 'React', color: 'bg-cyan-500/10 text-cyan-600' },
  { id: 'typescript', label: 'TypeScript', color: 'bg-blue-600/10 text-blue-700' },
  { id: 'python', label: 'Python', color: 'bg-yellow-500/10 text-yellow-600' },
  { id: 'database', label: 'Database', color: 'bg-orange-500/10 text-orange-600' },
  { id: 'devops', label: 'DevOps', color: 'bg-red-500/10 text-red-600' },
  { id: 'security', label: 'Security', color: 'bg-slate-500/10 text-slate-600' },
  { id: 'ai', label: 'AI/ML', color: 'bg-pink-500/10 text-pink-600' },
];

interface AIPersonaSettingsProps {
  onSave?: (persona: AIPersona) => void;
  className?: string;
}

export function AIPersonaSettings({ onSave, className }: AIPersonaSettingsProps) {
  const [persona, setPersona] = useState<AIPersona>(DEFAULT_PERSONA);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('beehive-ai-persona');
    if (saved) {
      try {
        setPersona(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load persona:', e);
      }
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('beehive-ai-persona', JSON.stringify(persona));
      
      await fetch('/api/ai/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(persona),
      }).catch(() => {});

      onSave?.(persona);
      toast({
        title: 'Persona saved',
        description: 'Scout will now use your custom settings',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Failed to save',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPersona(DEFAULT_PERSONA);
    localStorage.removeItem('beehive-ai-persona');
    toast({
      title: 'Reset to defaults',
      description: 'Persona settings have been restored',
    });
  };

  const toggleExpertise = (id: string) => {
    setPersona(p => ({
      ...p,
      expertise: p.expertise.includes(id)
        ? p.expertise.filter(e => e !== id)
        : [...p.expertise, id],
    }));
  };

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="ai-persona-settings">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-600" />
          <CardTitle>Customize Scout</CardTitle>
        </div>
        <CardDescription>
          Adjust how Scout communicates and what areas it specializes in
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 p-5">
        {/* Agent Name */}
        <div className="space-y-2">
          <Label htmlFor="persona-name" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Agent Name
          </Label>
          <Input
            id="persona-name"
            value={persona.name}
            onChange={(e) => setPersona(p => ({ ...p, name: e.target.value }))}
            placeholder="Scout"
            className="max-w-xs"
            data-testid="input-persona-name"
          />
        </div>

        {/* Tone Selection */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Communication Style
          </Label>
          <RadioGroup
            value={persona.tone}
            onValueChange={(v) => setPersona(p => ({ ...p, tone: v as AIPersona['tone'] }))}
            className="grid grid-cols-2 gap-2"
          >
            {[
              { value: 'professional', label: 'Professional', desc: 'Formal and thorough' },
              { value: 'friendly', label: 'Friendly', desc: 'Warm and approachable' },
              { value: 'concise', label: 'Concise', desc: 'Brief and to the point' },
              { value: 'detailed', label: 'Detailed', desc: 'In-depth explanations' },
            ].map(({ value, label, desc }) => (
              <div key={value} className="flex items-center space-x-2">
                <RadioGroupItem value={value} id={`tone-${value}`} />
                <Label htmlFor={`tone-${value}`} className="cursor-pointer">
                  <span className="font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{desc}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Expertise Areas */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Expertise Areas
          </Label>
          <div className="flex flex-wrap gap-2">
            {EXPERTISE_OPTIONS.map(({ id, label, color }) => (
              <Badge
                key={id}
                variant="outline"
                className={cn(
                  "cursor-pointer transition-all",
                  persona.expertise.includes(id) ? color : "opacity-50"
                )}
                onClick={() => toggleExpertise(id)}
                data-testid={`badge-expertise-${id}`}
              >
                {label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Verbosity Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Response Length</Label>
            <span className="text-xs text-muted-foreground">
              {persona.verbosity < 30 ? 'Brief' : persona.verbosity < 70 ? 'Balanced' : 'Detailed'}
            </span>
          </div>
          <Slider
            value={[persona.verbosity]}
            onValueChange={([v]) => setPersona(p => ({ ...p, verbosity: v }))}
            max={100}
            step={10}
            className="w-full"
            data-testid="slider-verbosity"
          />
        </div>

        {/* Toggle Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Show Thinking Process</Label>
              <p className="text-xs text-muted-foreground">Display Scout's reasoning in collapsible boxes</p>
            </div>
            <Switch
              checked={persona.showThinking}
              onCheckedChange={(v) => setPersona(p => ({ ...p, showThinking: v }))}
              data-testid="switch-show-thinking"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Fix Issues</Label>
              <p className="text-xs text-muted-foreground">Automatically fix detected problems</p>
            </div>
            <Switch
              checked={persona.autoFix}
              onCheckedChange={(v) => setPersona(p => ({ ...p, autoFix: v }))}
              data-testid="switch-auto-fix"
            />
          </div>
        </div>

        {/* Custom Instructions */}
        <div className="space-y-2">
          <Label htmlFor="custom-instructions">Custom Instructions</Label>
          <Textarea
            id="custom-instructions"
            value={persona.customInstructions}
            onChange={(e) => setPersona(p => ({ ...p, customInstructions: e.target.value }))}
            placeholder="Add any specific instructions for Scout..."
            className="min-h-[80px] resize-none"
            data-testid="textarea-custom-instructions"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={handleReset} data-testid="button-reset-persona">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-persona">
            <Save className="w-4 h-4 mr-2" />
            Save Persona
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default AIPersonaSettings;
