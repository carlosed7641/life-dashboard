"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

/** Vuelve a lanzar el consentimiento de Google (para conceder scopes que faltan). */
export async function reconnectGoogle(formData: FormData) {
  const to = (formData.get("redirectTo") as string) || "/";
  await signIn("google", { redirectTo: to });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
