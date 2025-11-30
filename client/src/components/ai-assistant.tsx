import { MessageCircle, Send, Loader2, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m BeeHiveAI, your coding assistant. Ask me for help with code, debugging, or explanations.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    setMessages([...messages, { role: 'user', content: input }]);
    setInput('');
    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I can help with that! Try breaking it down into smaller functions...',
        },
      ]);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-4 h-4" />
        <h3 className="font-semibold text-sm">BeeHiveAI Assistant</h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Card
              className={`max-w-xs px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="text-xs">{msg.content}</p>
              {msg.role === 'assistant' && (
                <div className="flex gap-1 mt-2">
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0">
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0">
                    <ThumbsUp className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0">
                    <ThumbsDown className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </Card>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <Card className="bg-muted px-3 py-2">
              <Loader2 className="w-3 h-3 animate-spin" />
            </Card>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleSend();
            }
          }}
          placeholder="Ask me anything... (Ctrl+Enter to send)"
          className="text-xs h-16 resize-none"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="h-full"
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
