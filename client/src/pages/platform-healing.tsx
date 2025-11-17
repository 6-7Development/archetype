import { UniversalChat } from '@/components/universal-chat';

export default function PlatformHealing() {
  return (
    <div className="h-screen w-full overflow-hidden">
      <UniversalChat 
        targetContext="platform"
        projectId={null}
      />
    </div>
  );
}
