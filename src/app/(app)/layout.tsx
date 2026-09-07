import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { UpcomingToast, type UpcomingEvent } from "@/components/upcoming-toast";
import { ChatWidget } from "@/components/chat/chat-widget";
import { getTodayEvents } from "@/lib/google/calendar";
import { GoogleConnectionError } from "@/lib/google/client";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let upcoming: UpcomingEvent[] = [];
  let revoked = false;
  try {
    const events = await getTodayEvents();
    upcoming = events
      .filter((e) => !e.allDay)
      .map((e) => ({
        id: e.id,
        title: e.title,
        startISO: e.start.toISOString(),
        htmlLink: e.htmlLink,
      }));
  } catch (e) {
    // Acceso revocado / token muerto → forzar re-login. Otras causas (scope,
    // sin permiso de Calendar) se ignoran: la app sigue funcionando.
    if (e instanceof GoogleConnectionError && e.revoked) revoked = true;
  }
  if (revoked) redirect("/login");

  return (
    <>
      <AppShell
        user={{
          name: session.user.name ?? null,
          email: session.user.email ?? null,
          image: session.user.image ?? null,
        }}
      >
        {children}
      </AppShell>
      <UpcomingToast events={upcoming} />
      <ChatWidget />
    </>
  );
}
