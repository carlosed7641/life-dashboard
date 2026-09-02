import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { TasksView } from "@/components/tasks-view";

export const dynamic = "force-dynamic";

export default async function TareasPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id },
    orderBy: [{ done: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-5 md:p-10">
      <h1 className="font-display text-2xl font-semibold">Tareas</h1>
      <TasksView
        initial={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          done: t.done,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        }))}
      />
    </div>
  );
}
