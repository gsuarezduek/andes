import { requireUser } from "@/lib/auth-helpers";
import { hasAdminAccess } from "@/lib/user-permissions";
import { CashViewerProvider } from "@/components/cash/cash-viewer-context";
import { prisma } from "@/lib/prisma";

export default async function CajaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const expenseCategories = await prisma.cashMovementCategory.findMany({
    where: { active: true },
    orderBy: { ordering: "asc" },
    select: { id: true, name: true },
  });
  return (
    <CashViewerProvider value={{ canApprove: hasAdminAccess(user.role), userId: user.id, expenseCategories }}>
      {children}
    </CashViewerProvider>
  );
}
