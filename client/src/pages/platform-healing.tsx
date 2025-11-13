import { OwnerGuard } from '@/components/owner-guard';
import { UniversalChat } from '@/components/universal-chat';

function PlatformHealingContent() {
  return (
    <div className="h-full flex flex-col">
      <UniversalChat 
        targetContext="platform"
        projectId={null}
      />
    </div>
  );
}

export default function PlatformHealing() {
  return (
    <OwnerGuard>
      <PlatformHealingContent />
    </OwnerGuard>
  );
}
