import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";

interface ArchitectNote {
  id: string;
  title: string;
  content: string;
  authorRole: string;
  createdAt: string; // Assuming it's a string, adjust if it's a Date object
}

interface ArchitectNotesData {
  notes: ArchitectNote[];
}

interface ArchitectNotesPanelProps {
  projectId: string | null;
}

export function ArchitectNotesPanel({ projectId }: ArchitectNotesPanelProps) {
  const { data: notes } = useQuery<ArchitectNotesData>({
    queryKey: ["/api/projects", projectId, "notes"],
    enabled: !!projectId,
  });
  
  if (!projectId || !notes?.notes?.length) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No architect notes yet</p>
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {notes.notes.map((note) => (
          <Card key={note.id} data-testid={`note-${note.id}`}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {note.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownRenderer content={note.content} />
              <div className="text-xs text-muted-foreground mt-2">
                By {note.authorRole} • {new Date(note.createdAt).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
