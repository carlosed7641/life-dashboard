import { auth } from "@/auth";
import { getTodaySummary } from "@/lib/summary";
import { IconSparkle } from "@/components/icons";

export async function SummaryBanner() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { content } = await getTodaySummary(session.user.id);

  if (!content) {
    return (
      <div className="flex items-start gap-3 rounded-[14px] border border-dashed border-accent-soft-border bg-accent-soft/40 px-[18px] py-4">
        <IconSparkle size={20} className="mt-0.5 shrink-0 text-accent" />
        <p className="text-[13.5px] leading-relaxed text-accent-ink">
          Pulsa <strong>«Resumen diario»</strong> para generar el resumen de hoy. También se
          regenera cada mañana automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-accent-soft-border bg-accent-soft px-[18px] py-4">
      <IconSparkle size={20} className="mt-0.5 shrink-0 text-[#15803d]" />
      <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-accent-ink">{content}</p>
    </div>
  );
}
