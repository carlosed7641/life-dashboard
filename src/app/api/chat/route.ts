import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { TOOLS, runTool, type Proposal } from "@/lib/chat/tools";
import { buildSystemPrompt } from "@/lib/chat/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5";
const MAX_ITERATIONS = 6;
const HISTORY_LIMIT = 20;
const MAX_MESSAGE_CHARS = 4000;

/** Devuelve la conversación más reciente del usuario con sus mensajes, para
 *  reconstruir el hilo al recargar la página. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const conversation = await prisma.conversation.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 200 } },
  });

  if (!conversation) return NextResponse.json({ conversationId: null, messages: [] });

  // Los 200 más recientes, mostrados en orden cronológico.
  return NextResponse.json({
    conversationId: conversation.id,
    messages: conversation.messages.reverse().map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const userId = session.user.id;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });
  }

  let body: { conversationId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const userMessage = (body.message ?? "").trim();
  if (!userMessage) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  if (userMessage.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "Mensaje demasiado largo" }, { status: 400 });
  }

  // Hilo único por usuario: la conversación indicada o, si no llega (o no es
  // suya), la más reciente. Solo se crea una nueva al guardar el primer par de
  // mensajes, para que un fallo no deje hilos vacíos que tapen el bueno.
  const existing =
    (body.conversationId
      ? await prisma.conversation.findFirst({
          where: { id: body.conversationId, userId },
          select: { id: true },
        })
      : null) ??
    (await prisma.conversation.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    }));

  // Los últimos HISTORY_LIMIT mensajes, en orden cronológico.
  const recent = existing
    ? await prisma.chatMessage.findMany({
        where: { conversationId: existing.id },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      })
    : [];
  const history = recent.reverse();
  // La API exige que el primer mensaje sea del usuario.
  while (history.length && history[0].role !== "user") history.shift();

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system = buildSystemPrompt();

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  const encoder = new TextEncoder();

  const sse = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* stream cerrado por el cliente */
        }
      };

      let assistantText = "";
      let nudgedMissingTool = false;
      const toolLog: Array<{ name: string; input: unknown }> = [];
      const proposals: Proposal[] = [];
      // Frases con las que el modelo suele "narrar" una propuesta sin haberla creado.
      const CLAIMS_PROPOSAL = /\bpropuse\b|en la tarjeta|conf[íi]rma\w*\b/i;

      try {
        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
          if (req.signal.aborted) break;

          const ms = anthropic.messages.stream({
            model: MODEL,
            max_tokens: 2000,
            system,
            tools: TOOLS,
            messages,
          });

          ms.on("text", (delta: string) => {
            assistantText += delta;
            send({ type: "text", delta });
          });

          const final = await ms.finalMessage();
          messages.push({ role: "assistant", content: final.content });

          if (final.stop_reason !== "tool_use") {
            // El modelo dice que propuso algo pero no invocó ninguna herramienta:
            // una sola vez, se le obliga a hacerlo para que aparezca la tarjeta.
            if (!nudgedMissingTool && proposals.length === 0 && CLAIMS_PROPOSAL.test(assistantText)) {
              nudgedMissingTool = true;
              assistantText = "";
              send({ type: "reset" });
              messages.push({
                role: "user",
                content:
                  "[sistema] No invocaste ninguna herramienta propose_*, así que el usuario no ve ninguna tarjeta y no se ha creado, editado ni borrado nada. Invoca AHORA la herramienta propose_* que corresponda con los datos que describiste. No repitas el texto anterior; con una frase corta tras la llamada basta.",
              });
              continue;
            }
            break;
          }

          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );
          const results: Anthropic.ToolResultBlockParam[] = [];

          for (const tu of toolUses) {
            send({ type: "tool", name: tu.name, phase: "start" });
            toolLog.push({ name: tu.name, input: tu.input });
            const out = await runTool(tu.name, tu.input, userId);
            if (out.proposal) {
              proposals.push(out.proposal);
              send({ type: "proposal", proposal: out.proposal });
            }
            send({ type: "tool", name: tu.name, phase: "end" });
            results.push({ type: "tool_result", tool_use_id: tu.id, content: out.content });
          }

          messages.push({ role: "user", content: results });

          if (iter === MAX_ITERATIONS - 1) {
            send({
              type: "text",
              delta: "\n\n_(Se alcanzó el límite de pasos; puede faltar información.)_",
            });
          }
        }

        const now = Date.now();
        const turn = [
          // Marcas de tiempo explícitas para que el orden usuario → asistente sea estable.
          { role: "user", content: userMessage, createdAt: new Date(now) },
          {
            role: "assistant",
            content: assistantText.trim() || "(sin respuesta)",
            toolCalls: toolLog.length
              ? (toolLog as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            createdAt: new Date(now + 1),
          },
        ];

        // Una sola escritura atómica: o se guarda el turno completo o nada.
        const saved = existing
          ? await prisma.conversation.update({
              where: { id: existing.id },
              data: { updatedAt: new Date(), messages: { create: turn } },
              select: { id: true },
            })
          : await prisma.conversation.create({
              data: {
                userId,
                title: userMessage.slice(0, 50) || "Nueva conversación",
                messages: { create: turn },
              },
              select: { id: true },
            });

        send({ type: "conversation", id: saved.id });

        send({ type: "done", proposals: proposals.length });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      }
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
