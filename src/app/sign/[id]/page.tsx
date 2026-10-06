import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";
import { missingClientFields, type SignatureSummary } from "@/lib/remote-signature";
import { SignPageClient, type SignOutcome } from "./sign-page-client";

export const metadata: Metadata = { title: "Firma — MDZ Rent a Car" };

// Página pública (sin sesión): el cliente la abre escaneando el QR de la
// pantalla del empleado. Prioridad del contenido (ver sign-page-client.tsx):
// primero las condiciones generales del contrato, después — más chico — el
// resto (lo que cargó el empleado, completar datos propios, firmar).
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

  if (!request) {
    return <SignPageClient outcome="invalid" initialLocale="es" />;
  }

  // Server component: se evalúa una vez por request, así que leer el reloj acá
  // es correcto (no es un render reactivo del cliente).
  // eslint-disable-next-line react-hooks/purity
  const expired = request.status === "pending" && request.expiresAt.getTime() <= Date.now();
  const outcome: SignOutcome = expired
    ? "expired"
    : request.status === "pending"
      ? "active"
      : (request.status as "signed" | "cancelled");
  // El pedido arranca desde el paso "Datos" del wizard: el cliente puede estar
  // mirando la pantalla bastante antes de que el borrador esté listo para
  // firmar. Mientras tanto no hay canvas — solo condiciones + resumen en vivo.
  const waitingForCompletion = outcome === "active" && !request.readyToSign;
  const summary = (request.summary as SignatureSummary | null) ?? undefined;
  const isReturn = request.type === "return_";
  // Datos del cliente que todavía no cargó el staff (VikRentCar no siempre
  // los trae) — el cliente los completa él mismo mientras sigue la entrega en
  // vivo. Solo aplica a la entrega: la devolución no vuelve a pedirlos.
  const missingFields =
    outcome === "active" && request.type === "handover" && request.rental
      ? missingClientFields({
          name: request.rental.clientName,
          email: request.rental.clientEmail,
          phone: request.rental.clientPhone,
          docNumber: request.rental.clientDocNumber,
          address: request.rental.clientAddress,
        })
      : [];

  return (
    <SignPageClient
      id={request.id}
      initialLocale={request.language as Locale}
      outcome={outcome}
      waitingForCompletion={waitingForCompletion}
      isReturn={isReturn}
      summary={summary}
      missingFields={missingFields}
      defaultName={request.signerName ?? ""}
    />
  );
}
