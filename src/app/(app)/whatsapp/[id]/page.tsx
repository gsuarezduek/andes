import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getConversation, findRelatedRentals, isSessionWindowOpen, markConversationRead } from "@/lib/whatsapp/conversations";
import { getRentalPickerOptions } from "@/lib/cash";
import { formatDate } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { rentalStatusDisplay } from "@/lib/rental-ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { MessageBubble } from "@/components/whatsapp/message-bubble";
import { SendForm } from "@/components/whatsapp/send-form";
import { ReopenForm } from "@/components/whatsapp/reopen-form";
import { CustomerInfoForm } from "@/components/whatsapp/customer-info-form";
import { BotToggle } from "@/components/whatsapp/bot-toggle";
import { RentalLinkPicker } from "@/components/whatsapp/rental-link-picker";
import { linkRental } from "@/app/(app)/whatsapp/actions";

export const metadata: Metadata = { title: "WhatsApp — Andes" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const conversation = await getConversation(id);
  if (!conversation) notFound();

  // Fire-and-forget: no bloquea el render, y no hace falta esperar a
  // confirmarlo para mostrar la página.
  after(() => markConversationRead(id).catch(() => {}));

  const windowOpen = isSessionWindowOpen(conversation.lastInboundAt);

  const [relatedRentals, rentalOptions, approvedTemplates] = await Promise.all([
    conversation.rental ? Promise.resolve([]) : findRelatedRentals(conversation.phoneE164),
    conversation.rental ? Promise.resolve([]) : getRentalPickerOptions(),
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
      <AutoRefresh intervalMs={8000} />
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
        {conversation.customer ? (
          <CustomerInfoForm
            customerId={conversation.customer.id}
            conversationId={conversation.id}
            name={conversation.customer.name}
            email={conversation.customer.email}
          />
        ) : null}
        <div className={`flex flex-col gap-2 ${conversation.customer ? "border-t border-foreground/10 pt-3" : ""}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Reserva vinculada</p>
          {conversation.rental ? (
            (() => {
              const { label, tone } = rentalStatusDisplay(conversation.rental.status, conversation.rental.bookingConfirmed);
              return (
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/rentals/${conversation.rental.id}`} className="text-sm hover:underline">
                    {conversation.rental.clientName} · {formatDate(conversation.rental.startAt)}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={tone}>{label}</Badge>
                    <form action={linkRental.bind(null, conversation.id, null)}>
                      <button type="submit" className="text-xs text-foreground/40 hover:text-red-600">
                        Quitar vínculo
                      </button>
                    </form>
                  </div>
                </div>
              );
            })()
          ) : (
            <>
              {relatedRentals.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-foreground/50">Coincidencias automáticas por teléfono:</p>
                  {relatedRentals.map((r) => {
                    const { label, tone } = rentalStatusDisplay(r.status, r.bookingConfirmed);
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                        <Link href={`/rentals/${r.id}`} className="hover:underline">
                          {r.clientName} · {formatDate(r.startAt)}
                        </Link>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge tone={tone}>{label}</Badge>
                          <form action={linkRental.bind(null, conversation.id, r.id)}>
                            <button type="submit" className="text-xs font-medium underline">
                              Vincular
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <RentalLinkPicker conversationId={conversation.id} options={rentalOptions} />
            </>
          )}
        </div>
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
