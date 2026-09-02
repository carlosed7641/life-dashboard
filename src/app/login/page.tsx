import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signInWithGoogle } from "@/app/actions/auth";
import { IconHome } from "@/components/icons";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white">
          <IconHome size={24} />
        </span>
        <h1 className="mt-5 font-display text-xl font-semibold">Mi Dashboard</h1>
        <p className="mt-2 text-sm text-muted">
          Tu calendario, correos, tareas y notas en un solo panel.
        </p>

        <form action={signInWithGoogle} className="mt-6">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2.5 rounded-[11px] bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <GoogleGlyph />
            Continuar con Google
          </button>
        </form>

        <p className="mt-4 text-xs text-muted">
          Se pedirá acceso de solo lectura a Calendar, Gmail y Drive.
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 488 512"
      fill="currentColor"
      aria-hidden
    >
      <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
    </svg>
  );
}
