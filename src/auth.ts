import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          // `offline` + `consent` son imprescindibles para recibir el refresh_token
          access_type: "offline",
          prompt: "consent",
          scope: GOOGLE_SCOPES,
        },
      },
    }),
  ],
  callbacks: {
    // Dashboard personal: solo el correo permitido puede entrar.
    async signIn({ user, account }) {
      const allowed = process.env.ALLOWED_EMAIL?.toLowerCase().trim();
      if (allowed && user.email?.toLowerCase() !== allowed) return false;

      // El PrismaAdapter no refresca los tokens de una cuenta ya vinculada:
      // al re-loguear quedan los viejos. Los sobrescribimos con los nuevos.
      // (En el primer login la fila aún no existe → updateMany no hace nada y
      //  el adapter la crea con estos mismos tokens.)
      if (account?.provider === "google" && user.id) {
        await prisma.account.updateMany({
          where: { userId: user.id, provider: "google" },
          data: {
            access_token: account.access_token,
            refresh_token: account.refresh_token ?? undefined,
            expires_at: account.expires_at,
            scope: account.scope,
            token_type: account.token_type,
            id_token: account.id_token,
          },
        });
      }
      return true;
    },
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
