import Link from "next/link";
import { cn } from "@/lib/cn";
import { reconnectGoogle } from "@/app/actions/auth";

export function Card({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[13px] font-semibold text-accent hover:text-accent-hover">
      {children}
    </Link>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export function ReconnectNotice({
  tool,
  callbackPath = "/",
}: {
  tool: string;
  callbackPath?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl bg-panel-muted p-4 text-sm">
      <p className="text-muted">
        No hay acceso a <span className="font-medium text-text">{tool}</span> — falta el permiso o la
        conexión caducó.
      </p>
      <form action={reconnectGoogle}>
        <input type="hidden" name="redirectTo" value={callbackPath} />
        <button
          type="submit"
          className="font-semibold text-accent hover:text-accent-hover"
        >
          Conectar / dar permiso
        </button>
      </form>
    </div>
  );
}

export function CardSkeleton({ title, rows = 4 }: { title: string; rows?: number }) {
  return (
    <Card title={title}>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-panel-muted" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    </Card>
  );
}
