import { Send, Copy, Settings2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function APIClient() {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://api.example.com/users');
  const [response, setResponse] = useState('');

  const handleSend = async () => {
    try {
      const res = await fetch(url, { method });
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse(`Error: ${error}`);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <Tabs defaultValue="request" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="flex-1 overflow-auto space-y-3">
          <div className="flex gap-2 items-center">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="text-xs px-2 py-1 border rounded bg-background w-20"
            >
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/endpoint"
              className="text-xs h-8"
            />
            <Button size="sm" onClick={handleSend} data-testid="button-send-request">
              <Play className="w-3 h-3 mr-1" />
              Send
            </Button>
          </div>

          <div>
            <label className="text-xs font-semibold mb-2 block">Headers</label>
            <Card className="p-2">
              <div className="text-xs space-y-1 font-mono">
                <div>Content-Type: application/json</div>
                <div>Authorization: Bearer token</div>
              </div>
            </Card>
          </div>

          <div>
            <label className="text-xs font-semibold mb-2 block">Body</label>
            <Textarea
              placeholder='{"key": "value"}'
              className="text-xs font-mono h-24"
            />
          </div>
        </TabsContent>

        <TabsContent value="response" className="flex-1 overflow-auto">
          {response ? (
            <Card className="p-3 bg-background">
              <pre className="text-xs font-mono overflow-auto whitespace-pre-wrap break-all">
                {response}
              </pre>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-muted-foreground">Send a request to see response</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
