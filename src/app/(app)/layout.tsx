import Image from "next/image";
import Link from "next/link";
import { after } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { getAssignedPendingCount } from "@/lib/tasks";
import { countNeedsReply } from "@/lib/whatsapp/conversations";
import { touchPresence, getOnlineUsers } from "@/lib/presence";
import { AppNav } from "@/components/app-nav";
import { InactivityLogout } from "@/components/inactivity-logout";
import { EvidenceSync } from "@/components/evidence-sync";
import { WhatsappSoundNotifier } from "@/components/whatsapp-sound-notifier";
import { logout, enableEmployeeView, disableEmployeeView } from "./actions";
import { triggerSync } from "./sync/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const isRealAdmin = user.realRole === "admin";
  const viewingAsEmployee = isRealAdmin && !isAdmin;
  const [taskCount, whatsappUnread, onlineUsers] = await Promise.all([
    getAssignedPendingCount(user.id),
    countNeedsReply(),
    getOnlineUsers(),
  ]);
  after(() => touchPresence(user.id));

  return (
    <div className="flex min-h-full flex-col">
      {/* z-40, no z-10: al ser `sticky` con z-index propio, el header arma su
          propia capa de apilamiento — todo lo de adentro (el menú de cuenta
          desplegable incluido) queda topeado a ese valor frente al resto de
          la página, sin importar el z-index que tenga el propio menú. Con
          z-10 quedaba por detrás del encabezado sticky del Calendario
          (z-30), tapando parte del menú. */}
      <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/80 backdrop-blur">
        <div className="relative mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image src="/icon.svg" alt="Andes" width={32} height={32} className="rounded-lg" />
            <span className="text-base font-bold tracking-tight">Andes</span>
          </Link>

          <AppNav
            isAdmin={isAdmin}
            userName={user.name}
            logout={logout}
            sync={triggerSync}
            taskCount={taskCount}
            whatsappUnread={whatsappUnread}
            onlineUsers={onlineUsers}
            isRealAdmin={isRealAdmin}
            viewingAsEmployee={viewingAsEmployee}
            enableEmployeeView={enableEmployeeView}
            disableEmployeeView={disableEmployeeView}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

      <InactivityLogout />
      <EvidenceSync />
      <WhatsappSoundNotifier />
    </div>
  );
}
