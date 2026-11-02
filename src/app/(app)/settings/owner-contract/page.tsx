import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/datetime";
import { SavedBanner } from "@/components/ui/saved-banner";
import { SectionHeading } from "@/components/ui/section-heading";
import { ORIGINAL_OWNER_CONTRACT_TEXT } from "@/lib/owner-contract";
import { OwnerContractForm } from "./owner-contract-form";

export const metadata: Metadata = { title: "Contrato de cesión — Andes" };

function signedLabel(n: number) {
  if (n === 0) return "todavía sin firmas";
  return n === 1 ? "firmada en 1 contrato" : `firmada en ${n} contratos`;
}

export default async function OwnerContractSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;

  const [versions, originalSignedCount] = await Promise.all([
    prisma.ownerContractVersion.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, body: true, createdAt: true, createdByName: true, _count: { select: { contracts: true } } },
    }),
    prisma.ownerContract.count({ where: { versionId: null } }),
  ]);
  const current = versions[0];
  const previous = versions.slice(1);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Contrato de cesión</h1>
        <p className="text-sm text-foreground/60">
          Cláusulas del contrato con los dueños de los autos de terceros. Los datos del propietario, del auto, el plazo y el
          estado se completan en cada contrato.
        </p>
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          Cada cambio se guarda como una versión nueva y rige para lo que se firme desde ese momento. Los contratos ya firmados
          conservan su texto.
        </p>
      </div>

      <SavedBanner show={saved === "1"} label="Contrato guardado. Rige desde ahora para las próximas firmas." />

      <p className="text-sm text-foreground/70">
        {current ? (
          <>
            Versión vigente: guardada por <span className="font-medium">{current.createdByName}</span> el{" "}
            {formatDateTime(current.createdAt)} · {signedLabel(current._count.contracts)}.
          </>
        ) : (
          <>Vigente: texto original del sistema (todavía no se editó).</>
        )}
      </p>

      <OwnerContractForm initial={current ?? ORIGINAL_OWNER_CONTRACT_TEXT} original={ORIGINAL_OWNER_CONTRACT_TEXT} />

      {current && (
        <section className="flex flex-col gap-3 border-t border-foreground/10 pt-6">
          <SectionHeading description="Solo lectura. Para volver a una versión anterior, copiá su texto en el editor y guardá.">
            Versiones anteriores
          </SectionHeading>
          <ul className="flex flex-col gap-2">
            {previous.map((v) => (
              <VersionItem key={v.id} heading={`${formatDateTime(v.createdAt)} · ${v.createdByName}`} detail={signedLabel(v._count.contracts)} text={v} />
            ))}
            <VersionItem heading="Texto original del sistema" detail={signedLabel(originalSignedCount)} text={ORIGINAL_OWNER_CONTRACT_TEXT} />
          </ul>
        </section>
      )}
    </div>
  );
}

function VersionItem({ heading, detail, text }: { heading: string; detail: string; text: { title: string; body: string } }) {
  return (
    <li>
      <details className="rounded-xl border border-foreground/10 px-4 py-3">
        <summary className="cursor-pointer text-sm">
          <span className="font-medium">{heading}</span>
          <span className="text-foreground/50"> · {detail}</span>
        </summary>
        <div className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-foreground/80">
          <p className="font-semibold">{text.title}</p>
          <p className="whitespace-pre-line">{text.body}</p>
        </div>
      </details>
    </li>
  );
}
