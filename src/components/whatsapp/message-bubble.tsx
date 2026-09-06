import { formatDateTime } from "@/lib/datetime";
import type { WhatsAppDirection } from "@prisma/client";

export type MessageData = {
  id: string;
  direction: WhatsAppDirection;
  body: string | null;
  viaTemplate: boolean;
  templateName: string | null;
  sentByBot: boolean;
  sentViaApp: boolean;
  createdAt: Date;
  sentBy: { name: string } | null;
  media: { storageKey: string; mimeType: string; kind: string } | null;
};

export function MessageBubble({ message }: { message: MessageData }) {
  const out = message.direction === "out";
  return (
    <div className={`flex flex-col ${out ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
          out ? "bg-foreground text-background" : "bg-foreground/[0.06]"
        }`}
      >
        {message.media ? <MediaPreview media={message.media} /> : null}
        {message.body ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
        {message.viaTemplate ? (
          <p className={`mt-1 text-xs ${out ? "text-background/70" : "text-foreground/50"}`}>
            Plantilla: {message.templateName}
          </p>
        ) : null}
      </div>
      <span className="mt-1 px-1 text-xs text-foreground/40">
        {formatDateTime(message.createdAt)}
        {out && message.sentByBot
          ? " · 🤖 Bot"
          : out && message.sentViaApp
            ? " · 📱 WhatsApp"
            : out && message.sentBy
              ? ` · ${message.sentBy.name}`
              : ""}
      </span>
    </div>
  );
}

function MediaPreview({ media }: { media: { storageKey: string; mimeType: string; kind: string } }) {
  const href = `/api/media?key=${encodeURIComponent(media.storageKey)}`;
  if (media.kind === "image" || media.kind === "sticker") {
    // eslint-disable-next-line @next/next/no-img-element -- viene de storage propio, no de un dominio externo optimizable
    return <img src={href} alt="Adjunto" className="mb-1.5 max-h-64 rounded-lg" />;
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="mb-1.5 block text-sm underline">
      📎 Ver adjunto ({media.kind})
    </a>
  );
}
