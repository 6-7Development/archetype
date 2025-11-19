import { UniversalChat } from "@/components/universal-chat";

export default function LomuChat() {
  return (
    <div className="h-screen w-full">
      <UniversalChat targetContext="project" />
    </div>
  );
}
