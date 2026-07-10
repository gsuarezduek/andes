import Image from "next/image";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar — Andes",
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <Image src="/icon.svg" alt="Andes" width={64} height={64} className="rounded-2xl" priority />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Andes</h1>
          <p className="text-sm text-foreground/60">MDZ Rent a Car</p>
        </div>
      </header>
      <LoginForm />
    </main>
  );
}
