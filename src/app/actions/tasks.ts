"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseDay } from "@/lib/format";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/tareas");
}

export async function createTask(input: {
  title: string;
  priority?: boolean;
  dueDate?: string | null;
}) {
  const userId = await requireUserId();
  const title = input.title.trim();
  if (!title) return;
  await prisma.task.create({
    data: {
      userId,
      title,
      priority: input.priority ?? false,
      dueDate: input.dueDate ? parseDay(input.dueDate) : null,
    },
  });
  refresh();
}

export async function toggleTask(id: string, done: boolean) {
  const userId = await requireUserId();
  await prisma.task.updateMany({ where: { id, userId }, data: { done } });
  refresh();
}

export async function setTaskPriority(id: string, priority: boolean) {
  const userId = await requireUserId();
  await prisma.task.updateMany({ where: { id, userId }, data: { priority } });
  refresh();
}

export async function updateTask(
  id: string,
  patch: { title?: string; dueDate?: string | null },
) {
  const userId = await requireUserId();
  await prisma.task.updateMany({
    where: { id, userId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.dueDate !== undefined
        ? { dueDate: patch.dueDate ? parseDay(patch.dueDate) : null }
        : {}),
    },
  });
  refresh();
}

export async function deleteTask(id: string) {
  const userId = await requireUserId();
  await prisma.task.deleteMany({ where: { id, userId } });
  refresh();
}
