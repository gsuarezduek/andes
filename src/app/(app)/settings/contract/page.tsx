import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/datetime";
import { SavedBanner } from "@/components/ui/saved-banner";
import { SectionHeading } from "@/components/ui/section-heading";
import { defaultContractFields, splitParagraphs } from "@/lib/contract-text";
import { ContractForm } from "./contract-form";

export const metadata: Metadata = { title: "Contrato — Andes" };

function signedLabel(n: number) {
  if (n === 0) return "todavía sin firmas";
  return n === 1 ? "firmada en 1 entrega/devolución" : `firmada en ${n} entregas/devoluciones`;
}

export default async function ContractSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;

  const [versions, originalSignedCount] = await Promise.all([
    prisma.contractVersion.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        esTitle: true,
        esBody: true,
        enTitle: true,
        enBody: true,
        createdAt: true,
        createdByName: true,
        _count: { select: { inspections: true } },
      },
    }),
    prisma.inspection.count({ where: { contractVersionId: null } }),
  ]);
  const original = defaultContractFields();
  const current = versions[0];
  const previous = versions.slice(1);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Contrato</h1>
        <p className="text-sm text-foreground/60">
          Condiciones generales que el cliente lee y acepta al firmar la entrega y la devolución: aparecen en la
          pantalla de firma (en el dispositivo y por QR) y en el acta PDF.
        </p>
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          Cada cambio se guarda como una versión nueva y rige para lo que se firme desde ese momento. Las entregas y
          devoluciones ya firmadas conservan el texto que firmó el cliente, también al reenviar el acta.
        </p>
      </div>

      <SavedBanner show={saved === "1"} label="Contrato guardado. Rige desde ahora para las próximas firmas." />

      <p className="text-sm text-foreground/70">
        {current ? (
          <>
            Versión vigente: guardada por <span className="font-medium">{current.createdByName}</span> el{" "}
            {formatDateTime(current.createdAt)} · {signedLabel(current._count.inspections)}.
          </>
        ) : (
          <>Vigente: texto original del sistema (todavía no se editó).</>
        )}
      </p>

      <ContractForm initial={current ?? original} original={original} />

      <section className="flex flex-col gap-3 border-t border-foreground/10 pt-6">
        <SectionHeading description="Solo lectura. Para volver a una versión anterior, copiá su texto en el editor y guardá.">
          Versiones anteriores
        </SectionHeading>
        <ul className="flex flex-col gap-2">
          {previous.map((v) => (
            <VersionItem
              key={v.id}
              heading={`${formatDateTime(v.createdAt)} · ${v.createdByName}`}
              detail={signedLabel(v._count.inspections)}
              fields={v}
            />
          ))}
          {/* El original solo es "anterior" si ya se guardó alguna versión. */}
          {current && (
            <VersionItem heading="Texto original del sistema" detail={signedLabel(originalSignedCount)} fields={original} />
          )}
        </ul>
        {!current && <p className="text-sm text-foreground/50">Todavía no hay versiones anteriores.</p>}
      </section>
    </div>
  );
}

function VersionItem({
  heading,
  detail,
  fields,
}: {
  heading: string;
  detail: string;
  fields: { esTitle: string; esBody: string; enTitle: string; enBody: string };
}) {
  return (
    <li>
      <details className="rounded-xl border border-foreground/10 px-4 py-3">
        <summary className="cursor-pointer text-sm">
          <span className="font-medium">{heading}</span>
          <span className="text-foreground/50"> · {detail}</span>
        </summary>
        <div className="mt-3 flex flex-col gap-4 text-sm leading-relaxed text-foreground/80">
          {(
            [
              ["Español", fields.esTitle, fields.esBody],
              ["Inglés", fields.enTitle, fields.enBody],
            ] as const
          ).map(([lang, title, body]) => (
            <div key={lang} className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{lang}</p>
              <p className="font-semibold">{title}</p>
              {splitParagraphs(body).map((p, i) => (
                <p key={i} className="whitespace-pre-line">{p}</p>
              ))}
            </div>
          ))}
        </div>
      </details>
    </li>
  );
}
