import { useState } from "react";
import { ChatArtifact, type Artifact } from "@/components/chat-artifact";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Mock artifacts for testing
const mockArtifacts: Artifact[] = [
  {
    id: "typescript-example",
    type: "code",
    title: "greet.ts",
    content: `function greet(name: string): string {
  console.log(\`Hello, \${name}!\`);
  return \`Greetings, \${name}! 🍋\`;
}

// Usage
const message = greet("BeeHive");
console.log(message);`,
    language: "typescript",
    metadata: {
      lineCount: 8,
    },
  },
  {
    id: "python-example",
    type: "code",
    title: "data_processor.py",
    content: `def process_data(items):
    """Process a list of items and return statistics."""
    total = sum(items)
    average = total / len(items) if items else 0
    
    return {
        'total': total,
        'average': average,
        'count': len(items),
        'max': max(items) if items else None,
        'min': min(items) if items else None
    }

# Example usage
data = [10, 20, 30, 40, 50]
stats = process_data(data)
print(f"Statistics: {stats}")`,
    language: "python",
    metadata: {
      lineCount: 16,
    },
  },
  {
    id: "javascript-example",
    type: "code",
    content: `// API request handler
async function fetchUserData(userId) {
  try {
    const response = await fetch(\`/api/users/\${userId}\`);
    
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    throw error;
  }
}`,
    language: "javascript",
    metadata: {
      lineCount: 14,
    },
  },
  {
    id: "json-example",
    type: "code",
    title: "config.json",
    content: `{
  "appName": "BeeHive",
  "version": "2.6.0",
  "features": {
    "artifacts": true,
    "syntaxHighlighting": true,
    "copyButton": true
  },
  "theme": {
    "primaryColor": "hsl(50, 98%, 58%)",
    "accentColor": "hsl(145, 60%, 45%)",
    "codeBackground": "hsl(222, 13%, 15%)"
  }
}`,
    language: "json",
    metadata: {
      lineCount: 13,
    },
  },
  {
    id: "sql-example",
    type: "code",
    content: `-- Find top 10 users by activity
SELECT 
  u.id,
  u.username,
  u.email,
  COUNT(a.id) as activity_count,
  MAX(a.created_at) as last_activity
FROM users u
LEFT JOIN activities a ON u.id = a.user_id
WHERE u.status = 'active'
GROUP BY u.id, u.username, u.email
ORDER BY activity_count DESC
LIMIT 10;`,
    language: "sql",
    metadata: {
      lineCount: 12,
    },
  },
];

export default function ArtifactDemo() {
  const { toast } = useToast();
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    mockArtifacts[0]
  );

  const handleCopy = (content: string) => {
    toast({
      title: "✅ Copied!",
      description: "Code copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">
            Chat Artifacts Demo 🍋
          </h1>
          <p className="text-muted-foreground">
            Rich inline code rendering with syntax highlighting
          </p>
          <Badge variant="secondary" className="mt-2">
            Phase 2.6 - MVP Implementation
          </Badge>
        </div>

        {/* Artifact Selector */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-3">
            Choose an example:
          </h2>
          <div className="flex flex-wrap gap-2">
            {mockArtifacts.map((artifact) => (
              <Button
                key={artifact.id}
                variant={selectedArtifact?.id === artifact.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedArtifact(artifact)}
                data-testid={`button-select-${artifact.id}`}
              >
                {artifact.title || artifact.language?.toUpperCase()}
              </Button>
            ))}
          </div>
        </Card>

        {/* Selected Artifact Display */}
        {selectedArtifact && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              Preview:
            </h2>
            <ChatArtifact
              artifact={selectedArtifact}
              onCopy={handleCopy}
            />
          </div>
        )}

        {/* Feature List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            ✅ Implemented Features
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-fresh-mint">✓</span>
              <span>Syntax highlighting for multiple languages (TypeScript, Python, JavaScript, SQL, JSON, etc.)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fresh-mint">✓</span>
              <span>Copy to clipboard with visual feedback</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fresh-mint">✓</span>
              <span>Language badge display</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fresh-mint">✓</span>
              <span>Line count metadata</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fresh-mint">✓</span>
              <span>Dark code background (consistent with Lomu design)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fresh-mint">✓</span>
              <span>Mobile responsive design</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fresh-mint">✓</span>
              <span>JetBrains Mono monospace font</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fresh-mint">✓</span>
              <span>Integrated with lomu-chat component</span>
            </li>
          </ul>
        </Card>

        {/* Usage Example */}
        <Card className="p-6 bg-muted/50">
          <h2 className="text-xl font-semibold mb-4">
            💡 Usage in Chat
          </h2>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Artifacts are automatically displayed when included in assistant messages:
            </p>
            <pre className="bg-background p-3 rounded-lg overflow-x-auto text-xs">
{`const message: Message = {
  id: "msg-123",
  role: "assistant",
  content: "Here's the code you requested:",
  artifacts: [{
    id: "artifact-1",
    type: "code",
    title: "example.ts",
    content: "function hello() { ... }",
    language: "typescript",
  }]
};`}
            </pre>
            <p className="text-muted-foreground">
              Or use the helper function to extract from markdown:
            </p>
            <pre className="bg-background p-3 rounded-lg overflow-x-auto text-xs">
{`import { parseMessageContent } from "@/utils/artifact-parser";

const { textContent, artifacts } = parseMessageContent(markdownText);`}
            </pre>
          </div>
        </Card>
      </div>
    </div>
  );
}
