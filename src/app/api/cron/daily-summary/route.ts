import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { generateSummaryForUser } from "@/lib/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const provided = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || provided !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  const results: Array<{ userId: string; ok: boolean; error?: string }> = [];

  for (const u of users) {
    try {
      await generateSummaryForUser(u.id, { force: true });
      results.push({ userId: u.id, ok: true });
    } catch (e) {
      results.push({ userId: u.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ran: results.length, results });
}
