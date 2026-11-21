import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signInWithGoogle } from "@/app/actions/auth";
import { IconDashboard, IconGoogle } from "@/components/icons";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white">
          <IconDashboard size={24} />
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
            <IconGoogle size={16} aria-hidden />
            Continuar con Google
          </button>
        </form>

        <p className="mt-4 text-xs text-muted">
          Se pedirá acceso de solo lectura a Calendar, Gmail y Drive.
        </p>

        <p className="mt-6 text-xs text-muted">
          <a href="/privacy" className="hover:underline">
            Política de privacidad
          </a>
          {" · "}
          <a href="/terms" className="hover:underline">
            Términos
          </a>
        </p>
      </div>
    </div>
  );
}

