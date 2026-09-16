/**
 * Lógica pura sobre "A recuperar" — separada de conversations.ts (que tiene
 * `import "server-only"`) porque esto lo necesita también un componente
 * cliente (conversation-list.tsx) para decidir el resaltado de vencido.
 */
export function isFollowUpStale(followUpAt: Date | null, staleDays: number, now: Date = new Date()): boolean {
  if (!followUpAt) return false;
  return now.getTime() - followUpAt.getTime() >= staleDays * 24 * 60 * 60 * 1000;
}
