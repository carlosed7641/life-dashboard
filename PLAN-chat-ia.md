# Chat IA acotado al contexto de la sesión

## Context

El dashboard ya lee Calendar, Gmail, Drive, tareas y notas, pero cada dato vive en su tarjeta. No hay forma de *preguntar* sobre ellos. El objetivo es un chat que responda cosas como:

- "¿cuántos de mis archivos pesan más de 150 MB?"
- "¿qué puedo responder al último correo que me enviaron?"
- "¿qué tengo libre el jueves por la tarde?"
- "anota que debo llamar al banco el viernes"

…y que ante *"¿cuál es la capital de Colombia?"* responda que no tiene esa información. El chat solo existe dentro del perímetro de los datos del usuario.

Decisiones ya tomadas: widget flotante global, historial persistido en la DB, y **CRUD completo sobre tareas y notas desde el chat, siempre con confirmación**. Google se queda en solo lectura (los scopes son `*.readonly` y no se tocan). Además, entrada por voz en el compositor.

**Forma de trabajo:** al terminar cada fase, entregar un **resumen breve** de lo hecho antes de pasar a la siguiente.

Orden de ejecución: Fase 1 → 2 → 3 → 5 → 6 → 4 → 7 → 7 bis → 8. (La Fase 4 necesita que la ruta y la UI existan para poder probar las tarjetas de confirmación; la Fase 9 queda aplazada.)

---

## Decisión de arquitectura: tool-use, NO embeddings/RAG

**Recomendación: no usar embeddings ni búsqueda vectorial.** Razones concretas para *este* caso:

1. **Las preguntas son agregaciones y filtros, no similitud semántica.** "Cuántos archivos pesan más de 150 MB" es un `filter + count` sobre un número. Un índice vectorial devuelve los *k* fragmentos más parecidos al texto de la pregunta — no sabe contar ni comparar bytes. RAG daría una respuesta plausible y equivocada.
2. **El corpus es diminuto.** Decenas de eventos, decenas de correos, cientos de archivos, un puñado de tareas y notas. Los datos crudos caben en el contexto del modelo; no hay nada que "recuperar".
3. **Los datos son vivos.** Un índice de embeddings habría que reindexarlo continuamente (correo nuevo, archivo movido, tarea marcada). Todo el coste de mantenimiento, cero beneficio.
4. **Ya existe un buscador mejor: la propia API.** Gmail tiene su sintaxis `q` (`from:`, `has:attachment`, `newer_than:`), Drive tiene la suya. Dejar que el modelo escriba esas consultas es más preciso que cualquier similitud coseno.

**En su lugar: bucle de tool-use.** Se le dan a Claude herramientas tipadas, él decide cuáles llamar, nosotros las ejecutamos server-side contra las mismas librerías que ya usa el dashboard, y le devolvemos el resultado. Esto además resuelve el requisito de acotación **por construcción**: no hay ninguna herramienta que devuelva conocimiento del mundo, así que no hay de dónde sacar la capital de Colombia.

> Cuándo *sí* valdría RAG: si algún día acumulas cientos de notas largas y quieres búsqueda semántica sobre ellas. Aun entonces, el primer paso sería `to_tsvector` de Postgres, no pgvector.

---

## Fase 1 — Ampliar la capa de datos

Las librerías actuales devuelven justo lo que pintan las tarjetas, y eso **no alcanza** para las preguntas de ejemplo. Tres huecos reales:

| Hueco | Dónde | Impacto |
|---|---|---|
| Drive no pide `size` | `src/lib/google/drive.ts` — el `fields` mask es `files(id, name, mimeType, webViewLink, viewedByMeTime, modifiedTime)` | La pregunta de los 150 MB es imposible hoy |
| Gmail solo trae cabeceras | `src/lib/google/gmail.ts` — `format: "metadata"` | No se puede redactar respuesta a un correo cuyo cuerpo no se ha leído |
| Calendar no trae descripción/asistentes | `src/lib/google/calendar.ts` | Preguntas sobre el contenido de un evento |

Ninguno requiere ampliar los scopes de OAuth: `size` es metadata (cubierto por `drive.metadata.readonly`) y `gmail.readonly` ya permite `format: "full"`.

### 1.1 `src/lib/google/drive.ts` — añadir `listFiles`

Nueva función junto a la existente `getRecentFiles` (que no se toca, la usan `/` y `/archivos`):

```ts
export type DriveFileFull = DriveFile & {
  sizeBytes: number | null;   // null en Docs/Sheets/Slides nativos: no reportan size
  modifiedTime: Date;
  createdTime: Date;
};

export async function listFiles(
  params: { q?: string; orderBy?: string; maxFiles?: number },
  explicitUserId?: string,
): Promise<{ files: DriveFileFull[]; truncated: boolean }>
```

Puntos de implementación:
- `fields: "nextPageToken, files(id, name, mimeType, size, webViewLink, viewedByMeTime, modifiedTime, createdTime)"`
- `size` llega como **string de bytes** y **falta** en archivos nativos de Google → `sizeBytes: f.size ? Number(f.size) : null`.
- **La API de Drive no permite filtrar por tamaño en `q`.** Para responder "cuántos pesan más de 150 MB" hay que traer el listado y filtrar en JS. Por eso `listFiles` pagina con `pageSize: 1000` hasta `maxFiles` (por defecto 2000) y devuelve `truncated: true` si se cortó — el modelo debe decir "al menos N" cuando venga truncado, en vez de dar un número falso.
- Reutilizar `categoryOf()` y `LABEL` que ya existen en el archivo.
- Envolver en `withGoogleAuth(userId, ...)` + `memo(key, 30_000, ...)` igual que las demás.

### 1.2 `src/lib/google/gmail.ts` — añadir `searchEmails` y `readEmail`

```ts
export type EmailHit = UnreadEmail & { snippet: string; unread: boolean; hasAttachments: boolean };

export async function searchEmails(
  params: { query: string; limit?: number },
  explicitUserId?: string,
): Promise<{ emails: EmailHit[]; total: number }>

export async function readEmail(
  id: string,
  explicitUserId?: string,
): Promise<{ from: string; to: string; subject: string; date: Date; body: string; truncated: boolean }>
```

- `searchEmails` es `getUnreadEmails` generalizada: el `query` deja de estar hardcodeado a `"is:unread in:inbox category:primary"` y lo escribe el modelo. Extraer la lógica común para no duplicar; `getUnreadEmails` pasa a ser un wrapper que llama a `searchEmails({ query: "is:unread in:inbox category:primary", limit })`.
- `readEmail` usa `format: "full"`, recorre recursivamente `payload.parts`, prefiere `text/plain`, cae a `text/html` con las etiquetas quitadas. El contenido viene en **base64url** → `Buffer.from(data, "base64url").toString("utf8")`. Truncar a ~6 000 caracteres y marcar `truncated`.
- Reutilizar `decodeMimeHeader` y `parseFrom` (hoy son privadas — basta exportarlas dentro del módulo).

### 1.3 `src/lib/google/calendar.ts` — añadir `listEvents`

```ts
export async function listEvents(
  params: { from: string; to: string; limit?: number },  // ISO dates
  explicitUserId?: string,
): Promise<Array<AgendaEvent & { description: string | null; location: string | null; attendees: string[] }>>
```

Mismo patrón que `getWeekEvents` pero con rango arbitrario y campos extra. `getTodayEvents`/`getWeekEvents` no se tocan.

### 1.4 Alcance por defecto (decidido tras probar)

- **`searchEmails`** restringe la query a la **bandeja principal** (`category:primary`) salvo que el modelo pase un `category:` / `label:` / `in:anywhere` explícito — igual que la vista `/correos`. Sin esto contaba Promociones, Social y notificaciones.
- **`listFiles`** añade `'me' in owners` al `q` por defecto: solo archivos **propios**, no los compartidos con el usuario. Parámetro `includeShared: true` para incluirlos.
- Ambos comportamientos se reflejan en las descripciones de las herramientas y en el system prompt.

---

## Fase 2 — Definición de herramientas

Nuevo archivo `src/lib/chat/tools.ts`: un array de `Anthropic.Tool` (nombre, descripción, `input_schema` JSON Schema) más un `runTool(name, input, userId)` que despacha.

| Herramienta | Llama a | Para qué |
|---|---|---|
| `list_calendar_events` | `listEvents` | "¿qué tengo el jueves?" |
| `search_emails` | `searchEmails` | El modelo escribe sintaxis Gmail (`from:x newer_than:7d`) |
| `read_email` | `readEmail` | Cuerpo completo, para redactar respuestas |
| `list_drive_files` | `listFiles` | Con `sizeBytes` → conteos y filtros por tamaño |
| `search_tasks` | `prisma.task.findMany` | Filtros por `done`, `priority`, `dueDate`, texto |
| `search_notes` | `prisma.note.findMany` con `contains` + `mode: "insensitive"` | Búsqueda por título/contenido |
| `propose_task_create` | *nada — devuelve propuesta* | Escritura, ver Fase 4 |
| `propose_task_update` | *ídem* | `{ id, title?, dueDate?, done?, priority? }` |
| `propose_task_delete` | *ídem* | `{ id }` |
| `propose_note_create` | *ídem* | `{ title, content }` |
| `propose_note_update` | *ídem* | `{ id, title?, content?, pinned? }` |
| `propose_note_delete` | *ídem* | `{ id }` |

Reglas de diseño:
- **Toda herramienta recibe `userId` desde la sesión del servidor, nunca desde el input del modelo.** El modelo no puede pedir datos de otro usuario porque no existe ese parámetro.
- Las descripciones son la mitad del trabajo: hay que decirle explícitamente que `sizeBytes` es `null` en Google Docs, que las fechas van en ISO y en zona `America/Bogota`, y la sintaxis de búsqueda de Gmail con ejemplos.
- Cada resultado se serializa a JSON compacto y se **recorta** (p. ej. máx. 50 archivos en el payload, pero devolviendo el conteo total ya calculado en el servidor) para no reventar el contexto.
- Errores: si `withGoogleAuth` lanza `GoogleConnectionError`, `runTool` lo captura y devuelve `{ error: "sin_acceso", tool: "drive" }` como `tool_result` en vez de tumbar la petición — el modelo dirá "no tengo acceso a Drive ahora mismo".

---

## Fase 3 — Acotación al contexto

Dos capas, en `src/lib/chat/prompt.ts`:

**a) Estructural (la que de verdad manda).** El modelo no tiene ninguna herramienta que devuelva hechos del mundo. Toda su información viene de las herramientas de arriba.

**b) System prompt estricto**, con estas instrucciones:
- Eres el asistente del dashboard personal de un usuario. Solo respondes usando datos obtenidos de las herramientas.
- Si la pregunta no se puede responder con esas fuentes, responde exactamente: *"No tengo esa información — solo puedo responder sobre tu calendario, correo, archivos de Drive, tareas y notas."*
- Nunca uses conocimiento general. Nunca inventes.
- Fecha y hora actual en `America/Bogota` (inyectada con `formatLongDate` + `todayKey` de `src/lib/format.ts` / `src/lib/time.ts`) — sin esto "el jueves" o "la semana pasada" no significan nada.
- Si un resultado viene `truncated`, dilo ("al menos N").
- Responde en español, breve, en markdown.
- 3-4 ejemplos few-shot de rechazo (capital de Colombia, receta de cocina, código genérico) — es lo que más sube la tasa de rechazo correcto.

*Nota honesta:* esta acotación es fuerte pero probabilística, no un candado. La garantía dura es que no hay herramienta que dé datos externos; el prompt es lo que evita que el modelo conteste de memoria. Con los ejemplos few-shot es fiable en la práctica.

---

## Fase 4 — Escrituras con confirmación (crear / editar / borrar)

El chat **nunca escribe en la DB por sí mismo**. El modelo *propone*, el usuario *ejecuta*. Flujo:

1. El modelo llama a una herramienta `propose_*`.
2. `runTool` **no toca Prisma**: valida el input, resuelve el estado actual del registro (para poder mostrar el antes/después) y devuelve `{ status: "pending_confirmation", proposalId }`. La ruta emite un evento SSE `proposal` con el payload.
3. La UI pinta una tarjeta de confirmación y espera el clic.
4. Al confirmar, el cliente llama a la **server action que ya existe** en `src/app/actions/`:

| Propuesta | Server action existente |
|---|---|
| `propose_task_create` | `createTask({ title, priority?, dueDate? })` |
| `propose_task_update` | `updateTask(id, patch)` / `toggleTask` / `setTaskPriority` |
| `propose_task_delete` | `deleteTask(id)` |
| `propose_note_create` | `createNote()` + `updateNote(id, { title, content })` — `createNote()` no recibe argumentos |
| `propose_note_update` | `updateNote(id, patch)` |
| `propose_note_delete` | `deleteNote(id)` |

No se abre ninguna ruta de escritura nueva: el único código que muta datos sigue siendo el de `src/app/actions/`, con su `requireUserId()` y su scoping `where: { id, userId }`.

### Salvaguardas para update/delete

Editar y borrar son más peligrosos que crear, así que llevan tres capas extra:

- **El modelo no inventa ids.** Los esquemas exigen un `id`, y la única forma de obtenerlo es haber llamado antes a `search_tasks` / `search_notes`. Si `runTool` recibe un id que no existe o no pertenece al usuario, devuelve error sin proponer nada.
- **Desambiguación obligatoria.** Instrucción explícita en el system prompt: si la búsqueda devuelve más de una coincidencia plausible, **pregunta cuál** en vez de proponer. Nunca borrar "la que parezca".
- **Confirmación explícita y descriptiva.** La tarjeta nunca dice "¿Borrar tarea?" a secas:
  - *update* → muestra **antes → después** campo por campo, solo los que cambian.
  - *delete* → muestra el título completo del registro, con estilo de peligro (rojo, no el verde de acento) y el botón etiquetado **Eliminar**, no "OK". Al confirmar se ofrece un **Deshacer** de ~8 s que recrea el registro con los datos que la propuesta ya tenía cargados.
- Las propuestas caducan al enviar el siguiente mensaje: una tarjeta vieja no se puede confirmar después.

---

## Fase 5 — Persistencia

Dos modelos nuevos en `prisma/schema.prisma`:

```prisma
model Conversation {
  id        String        @id @default(cuid())
  userId    String
  title     String        @default("Nueva conversación")
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  ChatMessage[]
  @@index([userId, updatedAt])
}

model ChatMessage {
  id             String       @id @default(cuid())
  conversationId String
  role           String       // "user" | "assistant"
  content        String       @db.Text
  toolCalls      Json?        // [{ name, input }] — para pintar "consultó Drive" al recargar
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId, createdAt])
}
```

Añadir `conversations Conversation[]` a `User`. Migración con `npx prisma migrate dev --name chat`.

**Decisión clave:** se guarda solo el **texto final** de cada turno, no los bloques `tool_use`/`tool_result`. Al reconstruir el historial se mandan turnos `user`/`assistant` planos. Esto mantiene la tabla legible y el contexto pequeño; el coste es que el modelo no "recuerda" el JSON crudo de una consulta anterior — si hace falta, vuelve a llamar la herramienta, que es lo correcto porque los datos son vivos.

Título de la conversación: las primeras ~50 caracteres del primer mensaje del usuario.

---

## Fase 6 — Ruta `POST /api/chat`

Nuevo `src/app/api/chat/route.ts`. Copiar el patrón de `src/app/api/cron/daily-summary/route.ts`:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
```

Flujo:
1. `auth()` → sin sesión, `401`.
2. Body `{ conversationId?: string, message: string }`.
3. Cargar los últimos ~20 `ChatMessage` de la conversación (verificando `userId`), o crear la conversación.
4. **Bucle de tool-use**, máximo 6 iteraciones:
   - `anthropic.messages.stream({ model, system, tools, messages, max_tokens: 2000 })`
   - Emitir por SSE los `text_delta` según llegan.
   - Si `stop_reason === "tool_use"`: emitir un evento `tool` (para el chip "Buscando en Drive…"), ejecutar cada `tool_use` con `runTool(name, input, userId)`, empujar los `tool_result` como turno `user` y repetir.
   - Si `stop_reason === "end_turn"`: cerrar.
5. Guardar el mensaje del usuario y la respuesta final en `ChatMessage`.
6. SSE con `ReadableStream` nativo (`text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`) — **no hace falta instalar el SDK `ai` de Vercel**; el `.stream()` del SDK de Anthropic ya expone los eventos.

Modelo: `claude-sonnet-5`, igual que `src/lib/summary.ts`. Con tool-use, Haiku se equivoca más eligiendo herramientas; si el coste molesta, se baja después cambiando una constante.

---

## Fase 7 — UI

`src/components/chat/chat-widget.tsx` (`"use client"`) + `chat-message.tsx`.

- **FAB** abajo a la derecha. ⚠️ **Colisión conocida:** `src/components/upcoming-toast.tsx` ya ocupa `bottom-right`. Hay que subir el toast (`bottom-24`) o desplazar el FAB — decidirlo al implementar mirando ambos en pantalla.
- **Panel:** `fixed inset-y-0 right-0 w-full sm:w-[420px]`, cabecera con título y cerrar, lista de mensajes, textarea con Enter=enviar / Shift+Enter=salto.
- **Streaming en cliente:** `fetch("/api/chat")` y leer `res.body.getReader()` + `TextDecoder`, parseando líneas `data: `. Estado local con `useState`; el texto del asistente se va concatenando.
- **Markdown:** reutilizar `react-markdown` + `remark-gfm`, que **ya están en `package.json`** (los usa `/notas`). Cero dependencias nuevas en todo el plan.
- **Chips de actividad** mientras corre una herramienta, y `<ProposalCard>` para las escrituras (ver Fase 4).
- **Botón de micrófono** en el compositor (Fase 8).
- **Montaje:** en `src/app/(app)/layout.tsx`, junto a `<UpcomingToast />`, dentro del guard de sesión que ya existe.
- Estilos con los tokens verdes ya definidos (`bg-card`, `border-border`, `text-accent`, `bg-accent-soft`).

---

## Fase 7 bis — Aviso visible de permisos

El chat tiene dos niveles de permiso y el usuario debe verlo sin tener que preguntarlo:

| Fuente | Permiso |
|---|---|
| Google Calendar, Gmail, Drive | **Solo lectura** — no se puede crear, editar ni borrar nada |
| Tareas y notas (tu propia DB) | **Acceso completo** — crear, editar y borrar, siempre con confirmación |

Se comunica en tres sitios, de más a menos permanente:

1. **Cabecera del panel** — bajo el título, una línea pequeña y permanente en `text-muted`:
   `🔒 Google: solo lectura · ✏️ Tareas y notas: edición`
   Es la que siempre está a la vista. Con `title=""` o un popover al pulsarla que despliega la tabla de arriba en detalle.

2. **Estado vacío** (primer mensaje de la conversación) — tarjeta de bienvenida con las dos filas explícitas:
   - 🔒 *Puedo **leer** tu calendario, correos y archivos de Drive. No puedo modificarlos.*
   - ✏️ *Puedo **crear, editar y borrar** tareas y notas — siempre te pido confirmación antes.*
   Y 3-4 preguntas de ejemplo pulsables, que además enseñan qué sabe hacer.

3. **En la propia conversación** — regla en el system prompt (Fase 3): si el usuario pide una acción de escritura sobre Google (*"bórrame ese correo"*, *"créame un evento"*), la respuesta explica el porqué en vez de un "no" seco: *"No puedo — tengo acceso de solo lectura a Gmail. Sí puedo crearte una tarea para que no se te olvide."* Es el momento en que el aviso importa de verdad, porque llega justo cuando choca con el límite.

Los `<ProposalCard>` de la Fase 4 refuerzan lo mismo desde el otro lado: toda escritura pasa por una tarjeta visible, así que nunca se muta nada de forma silenciosa.

Componente nuevo: `src/components/chat/permissions-note.tsx`, reutilizado en la cabecera y en el estado vacío. Iconos: reutilizar el patrón de `src/components/icons.tsx` (añadir `IconLock`).

---

## Fase 8 — Entrada por voz

Sí es posible, y en el navegador sale **gratis y sin backend**.

### Opción elegida: Web Speech API (nativa del navegador)

`window.SpeechRecognition ?? window.webkitSpeechRecognition`. El navegador hace la transcripción; nosotros solo recibimos texto.

- **Cero dependencias, cero API key, cero coste.** No pasa por nuestro servidor ni por Anthropic.
- Nuevo hook `src/lib/chat/use-speech.ts`:
  - `recognition.lang = "es-CO"`, `continuous = true`, `interimResults = true`
  - los resultados `isFinal` se acumulan en el texto del compositor; los provisionales se pintan atenuados detrás del cursor, así ves que te está oyendo
  - `onerror` (`no-speech`, `not-allowed`, `network`) → parar y mostrar un aviso discreto
- **UI:** botón de micrófono en el compositor. Mientras escucha: icono en rojo con pulso y el textarea en modo dictado. Se para al pulsar de nuevo, o automáticamente tras ~3 s de silencio. El texto queda **editable antes de enviar** — nunca se envía solo, el dictado es solo entrada de texto.
- **Requisitos:** HTTPS (localhost cuenta) y permiso de micrófono del navegador.
- **Compatibilidad:** Chrome, Edge y Safari (incl. iOS 14.1+) sí; **Firefox no**. Feature-detect → si no existe la API, el botón simplemente no se pinta.
- **Tipos:** el DOM lib de TypeScript no incluye `SpeechRecognition`. Declarar una interfaz mínima en `src/types/speech.d.ts` para no añadir `@types/dom-speech-recognition` y mantener la promesa de cero dependencias.

> Aviso de privacidad honesto: en Chrome de escritorio, esta API envía el audio a los servidores de Google para transcribirlo. Dado que la app ya lee tu Gmail y tu Drive con tu cuenta de Google, no cambia el perímetro — pero conviene saberlo.

### Plan B, solo si la calidad no convence

Grabar con `MediaRecorder` → `POST /api/transcribe` → API de transcripción (Whisper de OpenAI, o Groq que es más barato y rápido). Mejor precisión con acentos y ruido, pero: **nueva dependencia, nueva API key, coste por minuto** y latencia de subida. Ojo — **la API de Claude no acepta audio**, así que obliga a meter un segundo proveedor. Es un cambio que se puede hacer después sin tocar nada más que el hook, porque la interfaz (`onTranscript(text)`) es la misma.

---

## Fase 9 — Escritura en Google Calendar — **APLAZADA, no se implementa ahora**

> Decisión tomada: **no entra en esta entrega.** Se documenta para retomarla más adelante. Mientras no se haga, Google queda estrictamente en solo lectura y `src/auth.ts` no se toca.

Posible, pero es el único punto del plan que **rompe la garantía de "Google es solo lectura"**. Merece leerse entero antes de aprobarlo.

### 9.1 Cambio de scope

`src/auth.ts` — sustituir en `GOOGLE_SCOPES`:

```
- https://www.googleapis.com/auth/calendar.readonly
+ https://www.googleapis.com/auth/calendar.events
```

`calendar.events` da CRUD sobre eventos pero **no** permite crear/borrar calendarios ni tocar ajustes. Es el scope mínimo para esto; no usar `auth/calendar` a secas, que es mucho más amplio.

Consecuencias:
- **Re-consentimiento obligatorio.** El token actual no cubre el scope nuevo. Hay que volver a pasar por el consent de Google — ya está resuelto: `reconnectGoogle` en `src/app/actions/auth.ts` fuerza `prompt: "consent"`, y `ReconnectNotice` es el botón.
- **Verificación de Google: sin cambios.** `calendar.events` es un scope *sensible*; tú ya usas `gmail.readonly`, que es *restringido* (el escalón más estricto). No empeora nada — sigue siendo la misma pantalla de "Google no ha verificado esta app".
- **Degradación ya cubierta.** `getGoogleClientForUser(userId, requiredScope)` en `src/lib/google/client.ts` ya rechaza si el scope no está concedido. Si no autorizas el permiso nuevo, las herramientas de escritura devuelven `sin_acceso` y el chat lo dice; el resto del dashboard sigue igual.

### 9.2 Herramientas

Mismo patrón `propose_*` de la Fase 4 — el modelo propone, tú confirmas, y solo entonces se llama a Google:

| Herramienta | API |
|---|---|
| `propose_event_create` | `calendar.events.insert` |
| `propose_event_update` | `calendar.events.patch` |
| `propose_event_delete` | `calendar.events.delete` |

Nuevas funciones en `src/lib/google/calendar.ts` (`createEvent`, `updateEvent`, `deleteEvent`), envueltas en `withGoogleAuth` igual que las de lectura, y **invalidando el `memo`** (`invalidate("cal:")` de `src/lib/memo.ts`, que hoy no se usa) para que el dashboard refleje el cambio al instante en vez de esperar 30 s.

A diferencia de tareas y notas, aquí **no hay server action previa que reutilizar**: hay que crear `src/app/actions/calendar.ts` con las tres, cada una con `requireUserId()`.

### 9.3 Trampas reales (aquí es donde esto se rompe)

- **Eventos recurrentes.** Borrar el id de una *instancia* elimina esa ocurrencia; borrar el id del *evento recurrente* elimina toda la serie. Es fácil cargarse una reunión semanal entera sin querer. La tarjeta de confirmación debe decir explícitamente **"esta ocurrencia"** o **"las N ocurrencias de la serie"**, y el modelo debe preguntar cuál si el evento tiene `recurringEventId`.
- **Invitados.** Modificar o borrar un evento con asistentes **les manda correo**. Fijar `sendUpdates: "none"` por defecto en las tres operaciones, y que la tarjeta ofrezca una casilla *"avisar a los invitados"* solo si el evento tiene asistentes. Nada de emails accidentales a terceros.
- **No hay Deshacer.** Un evento borrado en Google no se recupera por API. El "deshacer" sería recrearlo, y volvería sin su id, sin su historial y con invitaciones nuevas. Por eso, para eventos, **el borrado solo se propone si el usuario lo pidió sin ambigüedad**, y la tarjeta muestra título, fecha/hora, invitados y recurrencia antes de dejar pulsar.
- **Zona horaria.** `events.insert` exige `start.dateTime` + `start.timeZone`. Usar siempre `APP_TZ` de `src/lib/time.ts` (`America/Bogota`); si se manda un ISO sin zona, Google lo interpreta como UTC y el evento sale 5 horas corrido — el mismo tipo de bug que ya arreglaste con `parseDay`.
- **Solo el calendario `primary`**, igual que la lectura. No exponer `calendarId` al modelo.

### 9.4 Verificación específica

- Crear *"reunión mañana 3pm"* → confirmar → comprobar la hora real en calendar.google.com (no a las 8pm).
- Editar la hora de ese evento → la tarjeta muestra antes → después.
- Crear un evento **con invitado** y borrarlo → verificar que **no** llega correo al invitado con `sendUpdates: "none"`.
- Sobre un evento recurrente, pedir *"borra la reunión de los lunes"* → debe preguntar si una ocurrencia o toda la serie.
- Iniciar sesión sin conceder el permiso nuevo → pedir crear un evento → debe responder que no tiene acceso, sin romperse.

### 9.5 Recomendación

Hacerlo **en un segundo paso, después de que el chat de solo lectura + CRUD de tareas/notas esté funcionando y probado**. Razones: obliga a re-consentir, es la única parte que puede afectar a *otras personas* (invitados), y no tiene deshacer. El resto del plan es reversible; esto no.

---

## Archivos

**Nuevos**
```
src/app/api/chat/route.ts          ruta SSE + bucle de tool-use
src/lib/chat/tools.ts              definiciones + runTool despachador
src/lib/chat/prompt.ts             system prompt y contexto temporal
src/lib/chat/use-speech.ts         hook de dictado (Web Speech API)
src/types/speech.d.ts              tipos mínimos de SpeechRecognition
src/components/chat/chat-widget.tsx
src/components/chat/chat-message.tsx
src/components/chat/proposal-card.tsx     confirmación crear/editar/borrar
src/components/chat/permissions-note.tsx  aviso "Google solo lectura / tareas y notas edición"
```

**Modificados**
```
src/lib/google/drive.ts            + listFiles (con size), sin tocar getRecentFiles
src/lib/google/gmail.ts            + searchEmails, readEmail; getUnreadEmails pasa a wrapper
src/lib/google/calendar.ts         + listEvents; + createEvent/updateEvent/deleteEvent (Fase 9)
src/app/actions/calendar.ts        NUEVO — server actions de escritura (Fase 9)
src/auth.ts                        calendar.readonly → calendar.events (Fase 9)
prisma/schema.prisma               + Conversation, ChatMessage, relación en User
src/app/(app)/layout.tsx           montar <ChatWidget />
src/components/upcoming-toast.tsx  reposicionar para no chocar con el FAB
src/components/icons.tsx           IconChat, IconSend, IconSparkles, IconMic, IconLock
```

Sin dependencias nuevas. Sin variables de entorno nuevas (`ANTHROPIC_API_KEY` ya existe). El único cambio de scope de OAuth es el de la Fase 9, que va aparte.

---

## Verificación

1. `npx prisma migrate dev --name chat` → comprobar las tablas en el panel de Supabase.
2. `npm run dev`, abrir el widget.
3. **Acotación:** preguntar *"¿cuál es la capital de Colombia?"* → debe rechazar con la frase exacta, sin llamar ninguna herramienta. Probar también *"escríbeme una función de quicksort"*.
4. **Agregación numérica:** *"¿cuántos archivos pesan más de 150 MB?"* → contrastar contra drive.google.com ordenado por tamaño. Verificar que los Google Docs (sin `size`) se excluyen y que lo dice.
5. **Cuerpo de correo:** *"¿qué puedo responder al último correo que me enviaron?"* → debe llamar `search_emails` y luego `read_email`, y citar contenido real del mensaje.
6. **Fechas relativas:** *"¿qué tengo el jueves?"* → contrastar con `/calendario`.
7. **Crear:** *"anota que debo llamar al banco el viernes"* → tarjeta de confirmación; pulsar Crear; verificar la tarea en `/tareas` con la fecha correcta (ojo al bug de zona horaria ya resuelto con `parseDay`).
8. **Editar:** *"cambia esa tarea a el lunes"* → la tarjeta debe mostrar **antes → después** solo del campo fecha.
9. **Borrar y desambiguar:** crear dos tareas con títulos parecidos y pedir *"borra la del banco"* → debe **preguntar cuál**, no elegir. Luego confirmar una y probar **Deshacer**.
10. **Voz:** pulsar el micrófono, dictar *"qué tengo mañana"*, comprobar que el texto aparece y que **no se envía solo**. Abrir en Firefox → el botón no debe aparecer (ni romper nada).
11. **Aviso de permisos:** la línea de cabecera está visible siempre; el estado vacío muestra las dos filas. Pedir *"bórrame ese correo"* y *"créame un evento el martes"* → debe explicar que Google es de solo lectura y ofrecer la alternativa (crear una tarea), no limitarse a negarse.
12. **Degradación:** revocar el acceso en [myaccount.google.com/permissions](https://myaccount.google.com/permissions) y preguntar por archivos → el chat debe decir que no hay acceso a Drive, no reventar. (El layout ya redirige al login ante `revoked`, así que probar antes con un scope suelto.)
13. **Persistencia:** recargar la página → el historial sigue ahí.
14. `npx tsc --noEmit` y `npx eslint src --max-warnings=0`.

---

## Fuera de alcance

- Embeddings / pgvector — justificado arriba
- Leer el **contenido** de archivos de Drive (PDFs, Docs) — requiere el scope `drive.readonly`, no `metadata.readonly`, y re-consentimiento
- Enviar o borrar correos desde el chat — Gmail se queda estrictamente en `gmail.readonly`
- Múltiples conversaciones con selector de hilos — el modelo de datos lo soporta, la UI arranca con una sola
