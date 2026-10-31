# Dashboard de Vida

Panel único con calendario, correos, tareas y notas. Next.js 16 (App Router) ·
Auth.js v5 · Prisma + Supabase Postgres · APIs de Google (solo lectura) ·
resumen diario y chat asistente con Claude.

**Demo:** https://life-dashboard-gamma-khaki.vercel.app

La navegación es responsive: sidebar en escritorio, menú + barra inferior en móvil
(breakpoint `md`, 768 px).

---

## 1. Requisitos previos

- Node 20+
- Una cuenta de **Supabase**, **Google Cloud** y **Anthropic**

## 2. Instalar

```bash
npm install
cp .env.example .env
```

## 3. Base de datos (Supabase)

1. Crea un proyecto en <https://supabase.com>.
2. **Project Settings → Database → Connection string** y copia a `.env`:
   - `DATABASE_URL` → cadena del **pooler**, modo *Transaction* (puerto **6543**),
     añade `?pgbouncer=true`.
   - `DIRECT_URL` → conexión **directa** (puerto **5432**).
3. Crea las tablas:
   ```bash
   npx prisma migrate dev --name init
   ```

## 4. Google OAuth

1. <https://console.cloud.google.com> → nuevo proyecto.
2. **APIs y servicios → Biblioteca**: habilita **Gmail API**, **Google Calendar API**
   y **Google Drive API**.
3. **Pantalla de consentimiento OAuth**: tipo *Externo*. Añade los scopes:
   ```
   openid  email  profile
   .../auth/gmail.readonly
   .../auth/calendar.readonly
   .../auth/drive.metadata.readonly
   ```
4. **Credenciales → Crear → ID de cliente OAuth → Aplicación web**. URIs de
   redirección autorizados:
   ```
   http://localhost:3000/api/auth/callback/google
   https://TU-APP.vercel.app/api/auth/callback/google
   ```
5. Copia el ID y el secreto a `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

> **Importante — refresh token.** Con la app en estado *Testing*, Google **caduca el
> refresh token cada 7 días** y tendrías que volver a iniciar sesión cada semana.
> Para uso personal: en la pantalla de consentimiento pulsa **"Publicar aplicación"**
> (estado *In production*). No necesitas verificación de Google; al iniciar sesión
> verás una pantalla de "app no verificada" → *Configuración avanzada* → *Continuar*.
> A partir de ahí los tokens dejan de caducar.

## 5. Resto de variables

```bash
npx auth secret          # genera AUTH_SECRET
```

- `ALLOWED_EMAIL` — solo este correo podrá entrar (déjalo vacío para permitir a
  cualquiera).
- `ANTHROPIC_API_KEY` — para el resumen diario y el chat asistente.
- `CRON_SECRET` — cadena larga y aleatoria (protege el endpoint del cron).
- `APP_TZ` — zona horaria para fechas y para agrupar el resumen (por defecto
  `America/Bogota`).

## 6. Arrancar

```bash
npm run dev
```

Abre <http://localhost:3000>. Te redirige a `/login`, inicias sesión con Google y
otorgas los permisos. Comprueba en Supabase que la fila `Account` tiene
`refresh_token` **no nulo** (si es nulo, faltó `prompt=consent` — revisa `src/auth.ts`).

---

## Despliegue en Vercel

1. Importa el repo en Vercel.
2. Variables de entorno: todas las de `.env` **más**:
   - `AUTH_URL = https://TU-APP.vercel.app`
3. `vercel.json` ya define:
   - `buildCommand: prisma generate && next build`
   - cron diario `0 12 * * *` UTC = **7:00 a. m. en Bogotá** → `/api/cron/daily-summary`
4. Añade la redirect URI de producción en Google Cloud (paso 4.4).

Probar el cron a mano:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://TU-APP.vercel.app/api/cron/daily-summary
```

---

## Estructura

```
src/
  auth.ts                      Auth.js v5 (Google, sesión en BD, acceso restringido)
  app/
    (app)/                     Rutas con sesión (guard + AppShell)
      page.tsx                 Resumen (dashboard)
      calendario/ tareas/ notas/ correos/ archivos/
    login/                     Pantalla de acceso
    privacy/ terms/            Política de privacidad y términos (login + verificación Google)
    api/auth/[...nextauth]/    Handler de Auth.js
    api/chat/route.ts          Streaming del chat con Claude (tool calling, SSE)
    api/cron/daily-summary/    Regenera el resumen (Vercel Cron)
    actions/                   Server Actions: tasks, notes, summary, auth, chat-proposals
  lib/
    db.ts                      Prisma singleton
    google/                    client (refresco de token) + calendar / gmail / drive
    summary.ts                 Genera el resumen con Claude y lo cachea en BD
    chat/                      client (SSE) · prompt (system prompt) · tools (lectura + propose_*) · use-speech (dictado)
    time.ts / format.ts        Fechas y horas en la zona de la app
    memo.ts                    Cache en memoria con TTL para las lecturas de Google
    nav.ts / cn.ts             Items de navegación · helper de clases
  components/
    app-shell.tsx              Sidebar + navegación móvil (drawer + barra inferior)
    cards/                     Tarjetas del dashboard
    notes/ calendar/           Editor de notas · vista semanal
    chat/                      Widget flotante, mensajes, tarjeta de propuesta, nota de permisos
prisma/schema.prisma           User/Account/Session + Task/Note/DailySummary + Conversation/ChatMessage
design/                        Mockups del diseño (canvas de Claude Design)
```

## Chat asistente (IA)

Widget flotante (botón inferior derecho) que responde en lenguaje natural sobre el
calendario, el correo, Drive, las tareas y las notas del usuario, usando Claude con
tool calling (`src/lib/chat/tools.ts`) y streaming por SSE (`src/app/api/chat/route.ts`).

- **Solo lectura sobre Google**: puede consultar Calendar, Gmail y Drive, pero nunca
  crea, edita ni borra nada ahí.
- **Tareas y notas mediante propuesta**: para crear/editar/borrar, el modelo emite una
  `propose_*` que se muestra como tarjeta (`components/chat/proposal-card.tsx`); el
  cambio solo se aplica si el usuario la confirma (`app/actions/chat-proposals.ts`).
- **Fuera de alcance**: preguntas ajenas a esas cuatro fuentes reciben una negativa
  fija (ver `REFUSAL` en `lib/chat/prompt.ts`), sin usar conocimiento general.
- **Dictado por voz**: `lib/chat/use-speech.ts` transcribe con la Web Speech API y
  auto-envía tras una pausa (contador configurable en `chat-widget.tsx`).
- El historial se guarda por usuario en `Conversation` / `ChatMessage` (Prisma).

## Notas de diseño

- Tokens de color en `src/app/globals.css` (`--accent #16A34A`, `--sidebar #0F2A1D`, …),
  expuestos como utilidades Tailwind (`bg-accent`, `text-muted`, `border-border`…).
- Tipografías: Space Grotesk (títulos) + IBM Plex Sans (texto) vía `next/font`.
- Lecturas de Google cacheadas 30 s por usuario (`lib/memo.ts`, TTL ajustable en los
  `memo(...)` de `lib/google/*`). Si una integración
  falla, su tarjeta muestra "Reconectar" sin tumbar el resto del panel.
- El resumen diario se guarda en `DailySummary (userId, date)`: la segunda carga del
  día es instantánea. El botón fuerza regeneración; el cron la hace cada mañana.
