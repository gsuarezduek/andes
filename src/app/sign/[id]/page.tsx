import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { SignatureSummary } from "@/lib/remote-signature";
import { COMPANY } from "@/lib/contract";
import { RemoteSignForm } from "./sign-form";

export const metadata: Metadata = { title: "Firma — MDZ Rent a Car" };

// Página pública (sin sesión): el cliente la abre escaneando el QR de la
// pantalla del empleado y firma en su propio teléfono.
export default async function RemoteSignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await prisma.signatureRequest.findUnique({ where: { id } });

  const dict = request ? getDictionary(request.language as Locale) : getDictionary("es");

  // Server component: se evalúa una vez por request, así que leer el reloj acá
  // es correcto (no es un render reactivo del cliente).
  // eslint-disable-next-line react-hooks/purity
  const expired = Boolean(request?.status === "pending" && request.expiresAt.getTime() <= Date.now());
  const status = expired ? "expired" : request?.status;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 py-8">
      <div>
        <p className="text-lg font-bold text-green-700 dark:text-green-500">{COMPANY.name}</p>
        <p className="text-sm text-foreground/60">{dict.signature.title}</p>
      </div>

      {!request ? (
        <Message text="Este enlace no es válido." />
      ) : status === "signed" ? (
        <Message text="¡Listo! La firma ya fue registrada. Podés cerrar esta página." tone="ok" />
      ) : status === "expired" ? (
        <Message text="El enlace de firma venció. Pedile al operador que genere uno nuevo." />
      ) : status === "cancelled" ? (
        <Message text="Este pedido de firma fue cancelado." />
      ) : (
        <RemoteSignForm
          id={request.id}
          legal={dict.signature.legal}
          signerNameLabel={dict.signature.signerName}
          clearLabel={dict.signature.clear}
          confirmLabel={dict.signature.confirm}
          acceptLabel={dict.signature.acceptConditions}
          termsTitle={dict.acta.termsTitle}
          settlementTitle={dict.acta.settlement.title}
          generalTitle={dict.legal.title}
          generalParagraphs={[
            ...dict.legal.paragraphs,
            dict.legal.photoConsent,
            dict.legal.jurisdiction,
            dict.legal.acceptance,
          ]}
          summary={(request.summary as SignatureSummary | null) ?? undefined}
          isReturn={request.type === "return_"}
          defaultName={request.signerName ?? ""}
        />
      )}
    </div>
  );
}

function Message({ text, tone }: { text: string; tone?: "ok" }) {
  return (
    <p
      className={`rounded-xl border px-4 py-6 text-center text-sm font-medium ${
        tone === "ok"
          ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-foreground/15 text-foreground/70"
      }`}
    >
      {text}
    </p>
  );
}
