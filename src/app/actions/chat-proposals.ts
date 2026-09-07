"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseDay } from "@/lib/format";
import type { ProposalKind } from "@/lib/chat/tools";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/tareas");
  revalidatePath("/notas");
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const bool = (v: unknown) => v === true;

export type ApplyProposalInput = {
  kind: ProposalKind;
  targetId: string | null;
  values: Record<string, unknown>;
};

/** Suficiente para revertir la acción sin volver a consultar. Viaja al cliente y regresa. */
export type UndoToken =
  | { op: "delete_created"; entity: "task" | "note"; id: string }
  | { op: "restore"; entity: "task" | "note"; data: Record<string, unknown> }
  | { op: "revert"; entity: "task" | "note"; id: string; data: Record<string, unknown> };

type ApplyResult = { ok: true; undo: UndoToken | null } | { ok: false; error: string };

/**
 * Aplica una propuesta del chat. Reejecuta la validación de propiedad: todas las
 * escrituras van con `where: { id, userId }`, así que una propuesta manipulada solo
 * puede afectar a datos del propio usuario.
 */
export async function applyProposal(input: ApplyProposalInput): Promise<ApplyResult> {
  const userId = await requireUserId();
  const { kind, targetId, values } = input;

  try {
    switch (kind) {
      case "task_create": {
        const title = str(values.title).trim();
        if (!title) return { ok: false, error: "Falta el título." };
        const task = await prisma.task.create({
          data: {
            userId,
            title,
            priority: bool(values.priority),
            dueDate: values.dueDate ? parseDay(str(values.dueDate)) : null,
          },
        });
        refresh();
        return { ok: true, undo: { op: "delete_created", entity: "task", id: task.id } };
      }

      case "task_update": {
        if (!targetId) return { ok: false, error: "Falta el identificador." };
        const cur = await prisma.task.findFirst({ where: { id: targetId, userId } });
        if (!cur) return { ok: false, error: "La tarea ya no existe." };
        const data: Record<string, unknown> = {};
        if (values.title !== undefined) data.title = str(values.title).trim();
        if (values.dueDate !== undefined)
          data.dueDate = values.dueDate ? parseDay(str(values.dueDate)) : null;
        if (values.done !== undefined) data.done = bool(values.done);
        if (values.priority !== undefined) data.priority = bool(values.priority);
        await prisma.task.updateMany({ where: { id: targetId, userId }, data });
        refresh();
        return {
          ok: true,
          undo: {
            op: "revert",
            entity: "task",
            id: targetId,
            data: taskSnapshot(cur),
          },
        };
      }

      case "task_delete": {
        if (!targetId) return { ok: false, error: "Falta el identificador." };
        const cur = await prisma.task.findFirst({ where: { id: targetId, userId } });
        if (!cur) return { ok: false, error: "La tarea ya no existe." };
        await prisma.task.deleteMany({ where: { id: targetId, userId } });
        refresh();
        return { ok: true, undo: { op: "restore", entity: "task", data: taskSnapshot(cur) } };
      }

      case "note_create": {
        const note = await prisma.note.create({
          data: {
            userId,
            title: str(values.title).trim() || "Nota sin título",
            content: str(values.content),
          },
        });
        refresh();
        return { ok: true, undo: { op: "delete_created", entity: "note", id: note.id } };
      }

      case "note_update": {
        if (!targetId) return { ok: false, error: "Falta el identificador." };
        const cur = await prisma.note.findFirst({ where: { id: targetId, userId } });
        if (!cur) return { ok: false, error: "La nota ya no existe." };
        const data: Record<string, unknown> = {};
        if (values.title !== undefined) data.title = str(values.title);
        if (values.content !== undefined) data.content = str(values.content);
        if (values.pinned !== undefined) data.pinned = bool(values.pinned);
        await prisma.note.updateMany({ where: { id: targetId, userId }, data });
        refresh();
        return {
          ok: true,
          undo: { op: "revert", entity: "note", id: targetId, data: noteSnapshot(cur) },
        };
      }

      case "note_delete": {
        if (!targetId) return { ok: false, error: "Falta el identificador." };
        const cur = await prisma.note.findFirst({ where: { id: targetId, userId } });
        if (!cur) return { ok: false, error: "La nota ya no existe." };
        await prisma.note.deleteMany({ where: { id: targetId, userId } });
        refresh();
        return { ok: true, undo: { op: "restore", entity: "note", data: noteSnapshot(cur) } };
      }

      default:
        return { ok: false, error: "Propuesta no reconocida." };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al aplicar el cambio." };
  }
}

export async function undoProposal(token: UndoToken): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  try {
    if (token.op === "delete_created") {
      if (token.entity === "task")
        await prisma.task.deleteMany({ where: { id: token.id, userId } });
      else await prisma.note.deleteMany({ where: { id: token.id, userId } });
    } else if (token.op === "restore") {
      if (token.entity === "task") {
        await prisma.task.create({
          data: {
            userId,
            title: str(token.data.title) || "Tarea",
            dueDate: token.data.dueDate ? parseDay(str(token.data.dueDate)) : null,
            done: bool(token.data.done),
            priority: bool(token.data.priority),
          },
        });
      } else {
        await prisma.note.create({
          data: {
            userId,
            title: str(token.data.title) || "Nota sin título",
            content: str(token.data.content),
            pinned: bool(token.data.pinned),
          },
        });
      }
    } else {
      if (token.entity === "task") {
        await prisma.task.updateMany({
          where: { id: token.id, userId },
          data: {
            title: str(token.data.title),
            dueDate: token.data.dueDate ? parseDay(str(token.data.dueDate)) : null,
            done: bool(token.data.done),
            priority: bool(token.data.priority),
          },
        });
      } else {
        await prisma.note.updateMany({
          where: { id: token.id, userId },
          data: {
            title: str(token.data.title),
            content: str(token.data.content),
            pinned: bool(token.data.pinned),
          },
        });
      }
    }
    refresh();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function taskSnapshot(t: {
  title: string;
  dueDate: Date | null;
  done: boolean;
  priority: boolean;
}): Record<string, unknown> {
  return {
    title: t.title,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    done: t.done,
    priority: t.priority,
  };
}

function noteSnapshot(n: {
  title: string;
  content: string;
  pinned: boolean;
}): Record<string, unknown> {
  return { title: n.title, content: n.content, pinned: n.pinned };
}
