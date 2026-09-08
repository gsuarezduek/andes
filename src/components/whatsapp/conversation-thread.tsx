import { MessageBubble, type MessageData } from "@/components/whatsapp/message-bubble";
import { SendForm } from "@/components/whatsapp/send-form";
import { ReopenForm } from "@/components/whatsapp/reopen-form";

type TemplateOption = { id: string; name: string; language: string; variableCount: number };

/**
 * Hilo de mensajes + compositor (o el form de retomar con plantilla si la
 * ventana de 24hs está cerrada). Compartido entre `/whatsapp/[id]` y la
 * pestaña "WhatsApp" del detalle de una reserva — mismo hilo, dos lugares
 * donde tiene sentido verlo.
 */
export function ConversationThread({
  conversationId,
  messages,
  windowOpen,
  templates,
}: {
  conversationId: string;
  messages: MessageData[];
  windowOpen: boolean;
  templates: TemplateOption[];
}) {
  return (
    <section className="flex flex-1 flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground/50">Todavía no hay mensajes.</p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>

      {windowOpen ? <SendForm conversationId={conversationId} /> : <ReopenForm conversationId={conversationId} templates={templates} />}
    </section>
  );
}
