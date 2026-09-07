import type { Proposal } from "@/lib/chat/tools";

export type ChatEvent =
  | { type: "conversation"; id: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; phase: "start" | "end" }
  | { type: "proposal"; proposal: Proposal }
  | { type: "done"; proposals: number }
  | { type: "error"; message: string };

/**
 * Envía un mensaje a /api/chat y consume el stream SSE, invocando `onEvent`
 * por cada evento. Se corta si se aborta el `signal`.
 */
export async function streamChat(
  body: { conversationId?: string; message: string },
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    onEvent({ type: "error", message });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(6)) as ChatEvent);
      } catch {
        /* fragmento incompleto o no-JSON: se ignora */
      }
    }
  }
}
