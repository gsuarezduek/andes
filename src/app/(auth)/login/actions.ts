"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

export async function authenticate(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    // signIn lanza un redirect en el éxito: hay que re-lanzarlo.
    if (error instanceof AuthError) {
      return { error: "Email o contraseña incorrectos." };
    }
    throw error;
  }
}

export async function signInWithGoogle() {
  // Lanza el redirect a Google (NEXT_REDIRECT); Next.js lo propaga.
  await signIn("google", { redirectTo: "/" });
}
