"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function normalizeAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to sign in right now. Please try again.";
  }

  if (error.message.includes("<!DOCTYPE") || error.message.includes("is not valid JSON")) {
    return "Authentication service returned an invalid response. Please restart THE SR'S PHARMACY and try again.";
  }

  return error.message || "Unable to sign in right now. Please try again.";
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect("/login?error=Enter%20both%20email%20and%20password.");
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
  } catch (error) {
    redirect(`/login?error=${encodeURIComponent(normalizeAuthError(error))}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
