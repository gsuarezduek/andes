import Image from "next/image";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña — Andes",
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <Image src="/icon.svg" alt="Andes" width={64} height={64} className="rounded-2xl" priority />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recuperar contraseña</h1>
          <p className="text-sm text-foreground/60">Te mandamos un link para elegir una nueva.</p>
        </div>
      </header>
      <ForgotPasswordForm />
    </main>
  );
}
