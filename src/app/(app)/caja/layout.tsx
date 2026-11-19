import { requireUser } from "@/lib/auth-helpers";
import { hasAdminAccess } from "@/lib/user-permissions";
import { CashViewerProvider } from "@/components/cash/cash-viewer-context";

export default async function CajaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <CashViewerProvider value={{ canApprove: hasAdminAccess(user.role), userId: user.id }}>
      {children}
    </CashViewerProvider>
  );
}
