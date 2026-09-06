import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getConversation, findRelatedRentals, isSessionWindowOpen } from "@/lib/whatsapp/conversations";
import { formatDate } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { rentalStatusDisplay } from "@/lib/rental-ui";
import { MessageBubble } from "@/components/whatsapp/message-bubble";
import { SendForm } from "@/components/whatsapp/send-form";
import { ReopenForm } from "@/components/whatsapp/reopen-form";
import { AssignForm } from "@/components/whatsapp/assign-form";
import { CustomerInfoForm } from "@/components/whatsapp/customer-info-form";
import { BotToggle } from "@/components/whatsapp/bot-toggle";

export const metadata: Metadata = { title: "WhatsApp — Andes" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const windowOpen = isSessionWindowOpen(conversation.lastInboundAt);

  const [users, relatedRentals, approvedTemplates] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    findRelatedRentals(conversation.phoneE164),
    windowOpen
      ? Promise.resolve([])
      : prisma.whatsAppTemplate.findMany({
          where: { status: "APPROVED" },
          orderBy: { name: "asc" },
          select: { id: true, name: true, language: true, variableCount: true },
        }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <ButtonLink href="/whatsapp" variant="secondary" className="mb-2 h-9 px-3 text-xs">
            ← Conversaciones
          </ButtonLink>
          <h1 className="text-xl font-bold tracking-tight">{conversation.customer?.name || conversation.phoneE164}</h1>
          <p className="text-sm text-foreground/60">{conversation.phoneE164}</p>
        </div>
        <BotToggle conversationId={conversation.id} botEnabled={conversation.botEnabled} />
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
        <AssignForm conversationId={conversation.id} users={users} assignedToId={conversation.assignedToId} />
        {conversation.customer ? (
          <CustomerInfoForm
            customerId={conversation.customer.id}
            conversationId={conversation.id}
            name={conversation.customer.name}
            email={conversation.customer.email}
          />
        ) : null}
        {relatedRentals.length > 0 ? (
          <div className="flex flex-col gap-1.5 border-t border-foreground/10 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Alquileres relacionados (por teléfono)
            </p>
            {relatedRentals.map((r) => {
              const { label, tone } = rentalStatusDisplay(r.status, r.bookingConfirmed);
              return (
                <Link
                  key={r.id}
                  href={`/rentals/${r.id}`}
                  className="flex items-center justify-between gap-2 text-sm hover:underline"
                >
                  <span>
                    {r.clientName} · {formatDate(r.startAt)}
                  </span>
                  <Badge tone={tone}>{label}</Badge>
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="flex flex-1 flex-col gap-3 rounded-xl border border-foreground/10 p-4">
        <div className="flex flex-col gap-3">
          {conversation.messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground/50">Todavía no hay mensajes.</p>
          ) : (
            conversation.messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
        </div>

        {windowOpen ? (
          <SendForm conversationId={conversation.id} />
        ) : (
          <ReopenForm conversationId={conversation.id} templates={approvedTemplates} />
        )}
      </section>
    </div>
  );
}
