import "server-only";
import { prisma } from "@/lib/prisma";

export type SyncSummary = {
  result: "success" | "partial" | "error";
  imported: number;
  updated: number;
  cancelled: number;
  skipped: number;
  errors: number;
  message: string;
};

export async function recordLog(
  result: SyncSummary["result"],
  imported: number,
  updated: number,
  errors: number,
  message: string,
): Promise<void> {
  await prisma.syncLog.create({
    data: { result, imported, updated, errors, message: message.slice(0, 1000) },
  });
}

export function buildMessage(s: {
  total: number;
  imported: number;
  updated: number;
  cancelled: number;
  skipped: number;
  errors: number;
  problems: string[];
}): string {
  const base = `${s.total} órdenes en ventana · nuevas ${s.imported} · actualizadas ${s.updated} · canceladas ${s.cancelled} · sin cambios ${s.skipped} · errores ${s.errors}`;
  if (s.problems.length === 0) return base;
  return `${base}\n${s.problems.slice(0, 10).join("\n")}`;
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
