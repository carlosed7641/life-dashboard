import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

/** Se lanza cuando no hay cuenta de Google utilizable (sin vincular, token revocado, etc.). */
export class GoogleConnectionError extends Error {
  /** true = el usuario revocó el acceso / el token ya no sirve → hay que re-autenticar. */
  revoked: boolean;
  constructor(message = "Sin conexión con Google", opts: { revoked?: boolean } = {}) {
    super(message);
    this.name = "GoogleConnectionError";
    this.revoked = opts.revoked ?? false;
  }
}

/** ¿El error viene de un token de Google inválido/revocado? */
export function isGoogleAuthError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { status?: number; code?: number | string; message?: string };
  const status = Number(err.status ?? err.code);
  if (status === 401) return true;
  return /invalid[_ ]grant|invalid[_ ]token|invalid authentication credentials|token has been expired or revoked/i.test(
    String(err.message ?? ""),
  );
}

/** Deja la cuenta Google sin tokens y cierra la sesión (fuerza re-login). */
export async function markGoogleRevoked(userId: string): Promise<void> {
  await prisma
    .$transaction([
      prisma.account.updateMany({
        where: { userId, provider: "google" },
        data: { access_token: null, refresh_token: null, expires_at: null },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ])
    .catch(() => {
      /* si falla, la próxima carga lo reintentará */
    });
}

/**
 * Ejecuta una llamada a las APIs de Google convirtiendo los fallos de
 * autenticación en `GoogleConnectionError({ revoked: true })` (y limpiando la
 * sesión), para que la app mande al login en vez de reventar.
 */
export async function withGoogleAuth<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof GoogleConnectionError) {
      if (e.revoked) await markGoogleRevoked(userId);
      throw e;
    }
    if (isGoogleAuthError(e)) {
      await markGoogleRevoked(userId);
      throw new GoogleConnectionError("Acceso a Google revocado", { revoked: true });
    }
    throw e;
  }
}

export const SCOPES = {
  calendar: "https://www.googleapis.com/auth/calendar.readonly",
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
  drive: "https://www.googleapis.com/auth/drive.metadata.readonly",
} as const;

/** Resuelve el userId: el explícito (cron) o el de la sesión actual. */
export async function resolveUserId(explicitUserId?: string): Promise<string> {
  if (explicitUserId) return explicitUserId;
  const session = await auth();
  if (!session?.user?.id) throw new GoogleConnectionError("Sin sesión");
  return session.user.id;
}

/**
 * Devuelve un OAuth2Client listo para usar con las APIs de Google.
 * Refresca el access_token si hace falta y persiste el nuevo en la BD.
 * Punto único de refresco: el resto del código solo consume esto.
 */
export async function getGoogleClientForUser(
  userId: string,
  requiredScope?: string,
): Promise<OAuth2Client> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account) {
    throw new GoogleConnectionError("No hay cuenta de Google vinculada", { revoked: true });
  }
  if (!account.access_token) {
    // La fila existe pero sin tokens: la vaciamos tras una revocación.
    throw new GoogleConnectionError("Acceso a Google revocado", { revoked: true });
  }
  if (
    requiredScope &&
    !(account.scope ?? "").split(/\s+/).includes(requiredScope)
  ) {
    throw new GoogleConnectionError(`Sin permiso concedido para ${requiredScope}`);
  }

  const client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  );
  client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    scope: account.scope ?? undefined,
    // Ojo: NO pasar token_type. Google lo devuelve como "bearer" (minúscula) y
    // su gateway rechaza el header `bearer ...`; google-auth-library usa "Bearer"
    // por defecto si se omite.
  });

  // Persistir cualquier token nuevo que emita la librería.
  client.on("tokens", (tokens) => {
    void prisma.account
      .update({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          access_token: tokens.access_token ?? account.access_token,
          expires_at: tokens.expiry_date
            ? Math.floor(tokens.expiry_date / 1000)
            : account.expires_at,
          refresh_token: tokens.refresh_token ?? account.refresh_token,
          scope: tokens.scope ?? account.scope,
        },
      })
      .catch(() => {
        /* no bloquear la petición por un fallo al guardar */
      });
  });

  const soonMs = Date.now() + 60_000;
  const expired = !account.expires_at || account.expires_at * 1000 < soonMs;
  if (expired) {
    if (!account.refresh_token) {
      throw new GoogleConnectionError("Falta refresh_token; vuelve a conectar Google");
    }
    try {
      await client.getAccessToken(); // fuerza el refresco y dispara el evento "tokens"
    } catch (e) {
      // invalid_grant = el refresh_token fue revocado
      if (isGoogleAuthError(e)) {
        await markGoogleRevoked(userId);
        throw new GoogleConnectionError("Acceso a Google revocado", { revoked: true });
      }
      throw new GoogleConnectionError("No se pudo refrescar el token de Google");
    }
  }

  return client;
}

export async function getGoogleClient(
  explicitUserId?: string,
  requiredScope?: string,
): Promise<OAuth2Client> {
  const userId = await resolveUserId(explicitUserId);
  return getGoogleClientForUser(userId, requiredScope);
}

/** Scopes que el usuario concedió realmente en el consentimiento de Google. */
export async function getGrantedScopes(explicitUserId?: string): Promise<string[]> {
  const userId = await resolveUserId(explicitUserId);
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { scope: true },
  });
  return account?.scope?.split(/\s+/).filter(Boolean) ?? [];
}
