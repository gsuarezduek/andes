import Image from "next/image";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Ingresar — Andes",
};

// Auth.js redirige acá con ?error=... cuando el sign-in de Google falla.
function errorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  if (code === "AccessDenied") {
    return "Esa cuenta de Google no está habilitada. Pedí al administrador que te dé de alta.";
  }
  return "No se pudo iniciar sesión con Google. Probá de nuevo.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <Image src="/icon.svg" alt="Andes" width={64} height={64} className="rounded-2xl" priority />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Andes</h1>
          <p className="text-sm text-foreground/60">MDZ Rent a Car</p>
        </div>
      </header>
      <LoginForm error={errorMessage(error)} googleEnabled={env.hasGoogleAuth} />
    </main>
  );
}
