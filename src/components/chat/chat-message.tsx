import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

export type ChatRole = "user" | "assistant";

export function ChatMessage({
  role,
  content,
  pending,
  time,
}: {
  role: ChatRole;
  content: string;
  pending?: boolean;
  /** Hora ya formateada ("9:41 a. m."), como en WhatsApp. */
  time?: string;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-sm text-white">
          {content}
          {time && <Time className="text-white/75">{time}</Time>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "markdown-body max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2 text-sm",
          pending && !content && "text-muted",
        )}
      >
        {content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        ) : pending ? (
          <span className="inline-flex gap-1">
            <Dot /> <Dot /> <Dot />
          </span>
        ) : null}
        {time && content && <Time className="text-muted">{time}</Time>}
      </div>
    </div>
  );
}

function Time({ children, className }: { children: string; className: string }) {
  return (
    <span className={cn("-mb-0.5 mt-0.5 block text-right text-[10.5px] leading-none", className)}>
      {children}
    </span>
  );
}

function Dot() {
  return (
    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-border-strong [animation-duration:1s]" />
  );
}
