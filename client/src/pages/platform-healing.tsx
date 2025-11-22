import { UniversalChat } from '@/components/universal-chat';
import { useQuery } from "@tanstack/react-query";

export default function PlatformHealing() {
  // 🔧 Read user's AI model preference to determine targetContext
  const { data: prefs } = useQuery({
    queryKey: ["/api/user/preferences"],
  });
  
  // Map aiModel preference to targetContext:
  // - "claude" → "architect" (I AM Architect uses Claude Sonnet 4)
  // - "gemini" → "platform" (LomuAI uses Gemini 2.5 Flash)
  const aiModel = (prefs as any)?.aiModel || "gemini"; // Default to gemini/LomuAI
  const targetContext: 'platform' | 'architect' = aiModel === 'claude' ? 'architect' : 'platform';
  
  return (
    <div className="h-screen w-full overflow-hidden">
      <UniversalChat 
        targetContext={targetContext}
        projectId={null}
      />
    </div>
  );
}
