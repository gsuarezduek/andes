import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { hashPasswordResetToken, isPasswordResetTokenUsable } from "@/lib/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Elegir nueva contraseña — Andes",
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashPasswordResetToken(token) },
  });
  const valid = Boolean(record) && isPasswordResetTokenUsable(record!, new Date());

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <Image src="/icon.svg" alt="Andes" width={64} height={64} className="rounded-2xl" priority />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nueva contraseña</h1>
          <p className="text-sm text-foreground/60">Elegí una contraseña nueva para tu cuenta.</p>
        </div>
      </header>
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-red-600 dark:text-red-400">
            El link venció o ya fue usado.
          </p>
          <Link
            href="/forgot-password"
            className="text-center text-foreground/60 underline underline-offset-2"
          >
            Pedir un link nuevo
          </Link>
        </div>
      )}
    </main>
  );
}
