"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

function refresh() {
  revalidatePath("/notas");
  revalidatePath("/");
}

export async function createNote() {
  const userId = await requireUserId();
  const note = await prisma.note.create({
    data: { userId, title: "Nota sin título", content: "" },
  });
  refresh();
  return note;
}

export async function updateNote(
  id: string,
  patch: { title?: string; content?: string; pinned?: boolean },
) {
  const userId = await requireUserId();
  await prisma.note.updateMany({
    where: { id, userId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
    },
  });
  refresh();
}

export async function deleteNote(id: string) {
  const userId = await requireUserId();
  await prisma.note.deleteMany({ where: { id, userId } });
  refresh();
}
