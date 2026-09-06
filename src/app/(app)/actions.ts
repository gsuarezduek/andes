"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { requireUser, EMPLOYEE_VIEW_COOKIE } from "@/lib/auth-helpers";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

/** Activa "Ver como empleado" (menú de cuenta). Solo un admin real puede prenderla. */
export async function enableEmployeeView() {
  const user = await requireUser();
  if (user.realRole !== "admin") return;

  const cookieStore = await cookies();
  cookieStore.set(EMPLOYEE_VIEW_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
}

export async function disableEmployeeView() {
  await requireUser();
  const cookieStore = await cookies();
  cookieStore.delete(EMPLOYEE_VIEW_COOKIE);
  revalidatePath("/", "layout");
}
