import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos de servicio · Mi Dashboard",
};

const UPDATED = "8 de septiembre de 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← Mi Dashboard
      </Link>

      <h1 className="mt-6 font-display text-2xl font-semibold">Términos de servicio</h1>
      <p className="mt-1 text-sm text-muted">Última actualización: {UPDATED}</p>

      <div className="markdown-body mt-8 space-y-5 text-[15px] leading-relaxed">
        <p>
          Mi Dashboard es una herramienta personal de uso privado. El acceso está restringido
          a una única cuenta autorizada por el propietario.
        </p>

        <h2 className="font-display text-lg font-semibold">Uso permitido</h2>
        <p>
          La aplicación se ofrece para consulta y organización personal de la información del
          propio usuario. No está pensada para uso por parte de terceros.
        </p>

        <h2 className="font-display text-lg font-semibold">Sin garantías</h2>
        <p>
          El servicio se presta &laquo;tal cual&raquo;, sin garantías de disponibilidad,
          exactitud ni continuidad. Los datos mostrados provienen de servicios de Google y de
          modelos de IA, y pueden contener errores u omisiones. El usuario es responsable de
          verificar la información antes de actuar sobre ella.
        </p>

        <h2 className="font-display text-lg font-semibold">Limitación de responsabilidad</h2>
        <p>
          El propietario no se hace responsable de pérdidas o daños derivados del uso o de la
          imposibilidad de uso de la aplicación.
        </p>

        <h2 className="font-display text-lg font-semibold">Cambios</h2>
        <p>
          Estos términos pueden actualizarse en cualquier momento. El uso continuado implica
          la aceptación de la versión vigente.
        </p>

        <h2 className="font-display text-lg font-semibold">Contacto</h2>
        <p>
          <a href="mailto:carlosed7641@gmail.com">carlosed7641@gmail.com</a>
        </p>
      </div>
    </main>
  );
}
