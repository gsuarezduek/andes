import "server-only";
import { prisma } from "@/lib/prisma";
import type { SyncResult } from "@prisma/client";

/** Abre una corrida. El llamador debe chequear `hasRunInProgress()` antes (guard de concurrencia). */
export async function startRun(triggeredBy: "manual" | "cron"): Promise<string> {
  const run = await prisma.competitorCheckRun.create({
    data: { triggeredBy, startedAt: new Date() },
  });
  return run.id;
}

export async function finishRun(
  runId: string,
  result: SyncResult,
  competitorsChecked: number,
  pricesFound: number,
  errors: number,
  message: string,
): Promise<void> {
  await prisma.competitorCheckRun.update({
    where: { id: runId },
    data: {
      finishedAt: new Date(),
      result,
      competitorsChecked,
      pricesFound,
      errors,
      message: message.slice(0, 1000),
    },
  });
}

export function buildRunMessage(s: {
  competitorsChecked: number;
  pricesFound: number;
  errors: number;
  problems: string[];
}): string {
  const base = `${s.competitorsChecked} competidor(es) · ${s.pricesFound} precio(s) encontrado(s) · ${s.errors} error(es)`;
  if (s.problems.length === 0) return base;
  return `${base}\n${s.problems.slice(0, 10).join("\n")}`;
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** ¿Hay una corrida en curso (sin terminar)? Guard de concurrencia — dos
 *  Chromium headless superpuestos es un modo de falla nuevo a evitar. */
export async function hasRunInProgress(): Promise<boolean> {
  const inProgress = await prisma.competitorCheckRun.findFirst({ where: { finishedAt: null } });
  return inProgress != null;
}
