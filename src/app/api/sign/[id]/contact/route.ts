import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSignatureRequestUsable, missingClientFields } from "@/lib/remote-signature";

export const runtime = "nodejs";

const optionalStr = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
  z.string().max(300).optional(),
);

const bodySchema = z.object({
  name: optionalStr,
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.email("Email inválido").optional(),
  ),
  phone: optionalStr,
  docNumber: optionalStr,
  address: optionalStr,
});

/**
 * El cliente completa él mismo los datos que falten (nombre, email, teléfono,
 * documento, domicilio) desde /sign/[id] — sin sesión, mismo id no adivinable
 * + expiración que la firma. Solo aplica a la entrega (los datos del cliente
 * no se piden de nuevo en una devolución) y solo mientras el pedido sigue
 * `pending`+vigente. Nunca pisa un campo que el staff ya haya cargado —
 * `missingClientFields` decide, server-side, qué se puede escribir; lo que
 * ya tiene valor se ignora aunque venga en el body.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const request = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  if (request.type !== "handover") {
    return NextResponse.json({ error: "no aplica a una devolución" }, { status: 400 });
  }
  if (!isSignatureRequestUsable(request, new Date())) {
    return NextResponse.json({ error: "el pedido no está disponible" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "datos inválidos" }, { status: 400 });

  const rental = await prisma.rental.findUnique({
    where: { id: request.rentalId },
    select: {
      status: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      clientDocNumber: true,
      clientAddress: true,
    },
  });
  if (!rental || rental.status !== "reserved") {
    return NextResponse.json({ error: "ya no se puede editar" }, { status: 409 });
  }

  const missing = new Set(
    missingClientFields({
      name: rental.clientName,
      email: rental.clientEmail,
      phone: rental.clientPhone,
      docNumber: rental.clientDocNumber,
      address: rental.clientAddress,
    }),
  );

  const data: { clientName?: string; clientEmail?: string; clientPhone?: string; clientDocNumber?: string; clientAddress?: string } = {};
  if (missing.has("name") && parsed.data.name) data.clientName = parsed.data.name;
  if (missing.has("email") && parsed.data.email) data.clientEmail = parsed.data.email;
  if (missing.has("phone") && parsed.data.phone) data.clientPhone = parsed.data.phone;
  if (missing.has("docNumber") && parsed.data.docNumber) data.clientDocNumber = parsed.data.docNumber;
  if (missing.has("address") && parsed.data.address) data.clientAddress = parsed.data.address;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, updated: false });
  }

  await prisma.rental.update({
    where: { id: request.rentalId },
    // A partir de acá el sync no vuelve a pisar los datos del cliente (mismo
    // criterio que `updateRentalDetails`).
    data: { ...data, clientEditedAt: new Date() },
  });

  return NextResponse.json({ ok: true, updated: true });
}
