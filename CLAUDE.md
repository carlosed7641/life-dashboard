@AGENTS.md

# Dashboard de Vida — contexto del proyecto

Panel personal de un solo usuario: calendario, correo y Drive de Google (solo lectura),
tareas y notas propias (Prisma/Supabase), resumen diario y un chat asistente — todo con
Claude. Next.js 16 (App Router) + Auth.js v5 + Tailwind v4. Detalle completo en `README.md`.

- **Acceso a Google es solo lectura** (`gmail.readonly`, `calendar.readonly`,
  `drive.metadata.readonly`). Nunca añadas escritura a `src/lib/google/*` sin cambiar
  también los scopes en Google Cloud y el README.
- **Tareas y notas se escriben solo vía propuesta confirmada por el usuario** cuando
  vienen del chat: el modelo llama a una herramienta `propose_*`
  (`src/lib/chat/tools.ts`), la UI la muestra como tarjeta
  (`src/components/chat/proposal-card.tsx`) y solo se aplica al confirmar
  (`src/app/actions/chat-proposals.ts`). No hagas que el chat mute la BD directamente.
- El system prompt del chat (`src/lib/chat/prompt.ts`) fija el perímetro de datos
  (calendario/correo/Drive/tareas/notas) y una respuesta fija para preguntas fuera de
  alcance — mantenlo si tocas ese archivo.
- Estructura, variables de entorno y flujo de OAuth: ver `README.md` (se actualiza junto
  con el código; si cambias rutas, modelos de Prisma o el chat, revisa que siga siendo
  correcto).
