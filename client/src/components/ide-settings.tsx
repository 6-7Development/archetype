import { Settings, Palette, Zap, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

export function IDESettings() {
  const [theme, setTheme] = useState('light');
  const [fontSize, setFontSize] = useState(14);
  const [autoSave, setAutoSave] = useState(true);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <Tabs defaultValue="editor" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="keybindings">Keybindings</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="flex-1 overflow-auto space-y-3">
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">Editor Preferences</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs">Font Size</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="10"
                    max="20"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-xs w-8">{fontSize}px</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs">Auto Save</label>
                <input type="checkbox" checked={autoSave} onChange={() => setAutoSave(!autoSave)} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs">Tab Size</label>
                <select className="text-xs px-2 py-1 border rounded bg-background">
                  <option>2 spaces</option>
                  <option>4 spaces</option>
                  <option>Tabs</option>
                </select>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="flex-1 overflow-auto space-y-3">
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Theme
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {['Light', 'Dark', 'Charcoal', 'Auto'].map((t) => (
                <Button
                  key={t}
                  variant={theme === t.toLowerCase() ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme(t.toLowerCase())}
                  className="text-xs"
                >
                  {t}
                </Button>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="keybindings" className="flex-1 overflow-auto space-y-2">
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">Common Shortcuts</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Save File</span>
                <Badge variant="outline">Ctrl+S</Badge>
              </div>
              <div className="flex justify-between">
                <span>Find</span>
                <Badge variant="outline">Ctrl+F</Badge>
              </div>
              <div className="flex justify-between">
                <span>Replace</span>
                <Badge variant="outline">Ctrl+H</Badge>
              </div>
              <div className="flex justify-between">
                <span>Command Palette</span>
                <Badge variant="outline">Ctrl+Shift+P</Badge>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
