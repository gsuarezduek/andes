import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { AppNav } from "@/components/app-nav";
import { logout } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/80 backdrop-blur">
        <div className="relative mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image src="/icon.svg" alt="Andes" width={32} height={32} className="rounded-lg" />
            <span className="text-base font-bold tracking-tight">Andes</span>
          </Link>

          <AppNav isAdmin={isAdmin} userName={user.name} logout={logout} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
