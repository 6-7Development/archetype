import { UniversalChat } from "@/components/universal-chat";
import { WorkspaceLayout } from "@/components/workspace-layout";

export default function LomuChat() {
  return (
    <WorkspaceLayout
      projectId="lomu-standalone"
      projectName="LomuAI Chat"
      mode="standard"
      isAdmin={false}
      userRole="user"
    >
      <div className="h-full w-full overflow-hidden">
        <UniversalChat targetContext="project" projectId="lomu-standalone" />
      </div>
    </WorkspaceLayout>
  );
}
