import { documentKindLabels } from "@/lib/labels";
import type { RentalDetail } from "@/lib/rental-detail-queries";

export function DocumentsSection({ documents }: { documents: RentalDetail["documents"] }) {
  if (documents.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-foreground/70">Documentos del cliente</h2>
      <div className="grid grid-cols-3 gap-2">
        {documents.map((doc) => (
          <a
            key={doc.id}
            href={`/api/media?key=${encodeURIComponent(doc.url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/media?key=${encodeURIComponent(doc.url)}`}
              alt={documentKindLabels[doc.kind]}
              className="aspect-square w-full rounded-lg border border-foreground/10 object-cover"
            />
            <span className="text-center text-[11px] text-foreground/60">{documentKindLabels[doc.kind]}</span>
          </a>
        ))}
      </div>
      <p className="text-xs text-foreground/40">Respaldo interno. No se incluyen en el acta ni en los emails.</p>
    </div>
  );
}
