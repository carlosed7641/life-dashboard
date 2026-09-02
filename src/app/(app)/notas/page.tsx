import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NotesWorkspace } from "@/components/notes/notes-workspace";

export const dynamic = "force-dynamic";

export default async function NotasPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const notes = await prisma.note.findMany({
    where: { userId },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <NotesWorkspace
      initialNotes={notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        pinned: n.pinned,
        updatedAt: n.updatedAt.toISOString(),
      }))}
    />
  );
}
