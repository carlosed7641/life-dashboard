import { Suspense } from "react";
import { auth } from "@/auth";
import { formatLongDate, greeting } from "@/lib/format";
import { CardSkeleton } from "@/components/ui";
import { IconSun, IconSunrise, IconMoon } from "@/components/icons";
import { DailySummaryButton } from "@/components/cards/daily-summary";
import { SummaryBanner } from "@/components/cards/summary-banner";
import {
  AgendaCard,
  PrioritiesCard,
  UnreadMailCard,
  PendingTasksCard,
  ConnectedToolsCard,
} from "@/components/cards/dashboard-cards";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null; // el layout ya redirige a /login
  const userId = session.user.id;
  const firstName = session.user.name?.split(" ")[0] ?? "";

  const { text: hello, part } = greeting();
  const GreetIcon = part === "night" ? IconMoon : part === "morning" ? IconSunrise : IconSun;

  return (
    <div className="flex max-w-[1200px] flex-col gap-5 p-5 md:p-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-semibold sm:text-[26px]">
            {hello}{firstName ? `, ${firstName}` : ""}
            <GreetIcon
              size={22}
              className={part === "night" ? "text-slate-400" : "text-amber"}
            />
          </h1>
          <p className="mt-1.5 text-sm text-muted">{formatLongDate(new Date())}</p>
        </div>
        <DailySummaryButton />
      </header>

      <Suspense fallback={<div className="h-16 animate-pulse rounded-[14px] bg-panel-muted" />}>
        <SummaryBanner />
      </Suspense>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Suspense fallback={<CardSkeleton title="Agenda de hoy" rows={5} />}>
          <AgendaCard />
        </Suspense>

        <Suspense fallback={<CardSkeleton title="Prioridades principales" />}>
          <PrioritiesCard userId={userId} />
        </Suspense>

        <Suspense fallback={<CardSkeleton title="Correos sin leer" rows={3} />}>
          <UnreadMailCard />
        </Suspense>

        <Suspense fallback={<CardSkeleton title="Tareas pendientes" rows={3} />}>
          <PendingTasksCard userId={userId} />
        </Suspense>

        <Suspense
          fallback={<CardSkeleton title="Herramientas conectadas" rows={2} />}
        >
          <ConnectedToolsCard className="md:col-span-2" />
        </Suspense>
      </div>
    </div>
  );
}
