import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad · Mi Dashboard",
};

const UPDATED = "8 de septiembre de 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← Mi Dashboard
      </Link>

      <h1 className="mt-6 font-display text-2xl font-semibold">Política de privacidad</h1>
      <p className="mt-1 text-sm text-muted">Última actualización: {UPDATED}</p>

      <div className="markdown-body mt-8 space-y-5 text-[15px] leading-relaxed">
        <p>
          Mi Dashboard es una aplicación personal de un solo usuario. Reúne en un panel
          privado el calendario, el correo, los archivos, las tareas y las notas de la
          persona que la usa. No tiene otros usuarios ni fines comerciales.
        </p>

        <h2 className="font-display text-lg font-semibold">Datos de Google a los que accede</h2>
        <p>
          Al iniciar sesión con Google se concede acceso de <strong>solo lectura</strong> a:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Google Calendar</strong> — eventos, para mostrarlos en la agenda.
          </li>
          <li>
            <strong>Gmail</strong> — remitente, asunto, fecha y, cuando lo pides expresamente
            en el chat, el cuerpo de un correo concreto. Nunca se envían, borran ni marcan
            correos.
          </li>
          <li>
            <strong>Google Drive</strong> — solo metadatos (nombre, tipo, tamaño, fechas). No
            se lee el contenido de los archivos.
          </li>
        </ul>
        <p>
          Estos datos se consultan en el momento de mostrar el panel y no se almacenan de
          forma permanente, salvo el resumen diario descrito abajo.
        </p>

        <h2 className="font-display text-lg font-semibold">Datos que se guardan</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Tareas y notas</strong> que crea el propio usuario, en una base de datos
            privada (Supabase/PostgreSQL).
          </li>
          <li>
            <strong>Tokens de acceso de Google</strong>, guardados en esa misma base de datos
            para mantener la sesión y refrescarla. Se eliminan al cerrar sesión o al revocar
            el acceso.
          </li>
          <li>
            <strong>Resumen diario e historial del chat</strong> generados por el usuario.
          </li>
        </ul>

        <h2 className="font-display text-lg font-semibold">Uso de inteligencia artificial</h2>
        <p>
          Para el resumen diario y el asistente de chat, un extracto de los datos del día
          (títulos de eventos, remitentes y asuntos de correos, tareas y notas) se envía a la
          API de Anthropic (Claude). Anthropic no utiliza este contenido para entrenar sus
          modelos. Ningún dato se envía a otros terceros.
        </p>

        <h2 className="font-display text-lg font-semibold">Con quién se comparte</h2>
        <p>
          Con nadie. Los datos no se venden, no se comparten con fines publicitarios y no se
          combinan con fuentes externas. Los únicos proveedores que intervienen son la
          infraestructura de alojamiento (Vercel), la base de datos (Supabase) y la API de IA
          (Anthropic), cada uno solo para prestar su servicio.
        </p>

        <h2 className="font-display text-lg font-semibold">Cómo revocar el acceso</h2>
        <p>
          En cualquier momento desde{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
          >
            myaccount.google.com/permissions
          </a>
          . Al hacerlo, la aplicación pierde el acceso y elimina los tokens guardados.
        </p>

        <h2 className="font-display text-lg font-semibold">Contacto</h2>
        <p>
          Para cualquier consulta sobre esta política:{" "}
          <a href="mailto:carlosed7641@gmail.com">carlosed7641@gmail.com</a>.
        </p>
      </div>
    </main>
  );
}
