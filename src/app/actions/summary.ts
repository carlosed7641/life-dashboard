"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { generateSummaryForUser } from "@/lib/summary";

export async function generateDailySummary() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const state = await generateSummaryForUser(session.user.id, { force: true });
  revalidatePath("/");
  return state;
}
