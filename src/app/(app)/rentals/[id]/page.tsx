import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  rentalStatusLabels,
  rentalOriginLabels,
  languageLabels,
} from "@/lib/labels";
import { rentalStatusTone } from "@/lib/rental-ui";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Alquiler — Andes" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

export default async function RentalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const rental = await prisma.rental.findUnique({
    where: { id },
    include: { vehicle: true },
  });
  if (!rental) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{rental.clientName}</h1>
          <p className="text-sm text-foreground/60">
            {rentalOriginLabels[rental.origin]}
            {rental.wpBookingId ? ` · orden #${rental.wpBookingId}` : ""}
          </p>
        </div>
        <Badge tone={rentalStatusTone[rental.status]}>
          {rentalStatusLabels[rental.status]}
        </Badge>
      </div>

      <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
        <Row label="Email" value={rental.clientEmail} />
        <Row label="Teléfono" value={rental.clientPhone} />
        <Row label="Documento" value={rental.clientDocNumber} />
        <Row
          label="Vehículo"
          value={
            rental.vehicle ? (
              <Link className="underline" href={`/vehicles/${rental.vehicle.id}`}>
                {rental.vehicle.brand} {rental.vehicle.model} · {rental.vehicle.plate}
              </Link>
            ) : (
              "Sin asignar"
            )
          }
        />
        <Row label="Retiro" value={formatDateTime(rental.startAt)} />
        <Row label="Devolución" value={formatDateTime(rental.endAt)} />
        <Row label="Idioma" value={languageLabels[rental.language]} />
      </div>

      <ButtonLink href="/rentals" variant="secondary">
        Volver
      </ButtonLink>

      <p className="text-xs text-foreground/40">
        Iniciar la entrega y la devolución llega en las Fases 2 y 3.
      </p>
    </div>
  );
}
