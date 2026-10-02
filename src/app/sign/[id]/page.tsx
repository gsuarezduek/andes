import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getDictionary, type Locale } from "@/lib/i18n";
import { missingClientFields, type SignatureSummary } from "@/lib/remote-signature";
import { COMPANY } from "@/lib/contract";
import { AutoRefresh } from "@/components/auto-refresh";
import { RemoteSignForm, SignatureSummaryView } from "./sign-form";
import { ClientContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Firma — MDZ Rent a Car" };

// Página pública (sin sesión): el cliente la abre escaneando el QR de la
// pantalla del empleado y firma en su propio teléfono.
export default async function RemoteSignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await prisma.signatureRequest.findUnique({
    where: { id },
    include: {
      rental: {
        select: { clientName: true, clientEmail: true, clientPhone: true, clientDocNumber: true, clientAddress: true },
      },
    },
  });

  const dict = request ? getDictionary(request.language as Locale) : getDictionary("es");

  // Server component: se evalúa una vez por request, así que leer el reloj acá
  // es correcto (no es un render reactivo del cliente).
  // eslint-disable-next-line react-hooks/purity
  const expired = Boolean(request?.status === "pending" && request.expiresAt.getTime() <= Date.now());
  const status = expired ? "expired" : request?.status;
  const summary = (request?.summary as SignatureSummary | null) ?? undefined;
  const isReturn = request?.type === "return_";
  // El pedido ahora arranca desde el paso "Datos" del wizard: el cliente
  // puede estar mirando la pantalla bastante antes de que el borrador esté
  // listo para firmar. Mientras tanto ve el resumen en vivo (sin canvas) y la
  // página se refresca sola para reflejar lo que el empleado va cargando.
  const waitingForCompletion = status === "pending" && !request?.readyToSign;
  // Datos del cliente que todavía no cargó el staff (VikRentCar no siempre
  // los trae) — el cliente los completa él mismo mientras sigue la entrega en
  // vivo. Solo aplica a la entrega: la devolución no vuelve a pedirlos.
  const missingFields =
    status === "pending" && request && request.type === "handover" && request.rental
      ? missingClientFields({
          name: request.rental.clientName,
          email: request.rental.clientEmail,
          phone: request.rental.clientPhone,
          docNumber: request.rental.clientDocNumber,
          address: request.rental.clientAddress,
        })
      : [];

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
      ) : waitingForCompletion ? (
        <>
          <AutoRefresh intervalMs={3000} />
          {missingFields.length > 0 && <ClientContactForm id={request.id} missing={missingFields} />}
          <SignatureSummaryView
            summary={summary}
            isReturn={isReturn}
            termsTitle={dict.acta.termsTitle}
            settlementTitle={dict.acta.settlement.title}
          />
          <p className="rounded-xl border border-foreground/15 px-4 py-6 text-center text-sm text-foreground/60">
            Estamos completando los datos de tu {isReturn ? "devolución" : "entrega"}. Esta pantalla se va a
            actualizar sola — en un momento vas a poder firmar acá mismo.
          </p>
        </>
      ) : (
        <>
          <AutoRefresh intervalMs={4000} />
          {missingFields.length > 0 && <ClientContactForm id={request.id} missing={missingFields} />}
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
            summary={summary}
            isReturn={isReturn}
            defaultName={request.signerName ?? ""}
          />
        </>
      )}
    </div>
  );
}

function Message({ text, tone }: { text: string; tone?: "ok" }) {
  return (
    <p
      className={`rounded-xl border px-4 py-6 text-center text-sm font-medium ${
        tone === "ok"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-foreground/15 text-foreground/70"
      }`}
    >
      {text}
    </p>
  );
}
