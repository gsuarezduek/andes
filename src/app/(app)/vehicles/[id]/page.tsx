import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Croquis } from "@/components/inspection/croquis";
import { KmChart } from "@/components/vehicle/km-chart";
import {
  vehicleStatusLabels,
  maintenanceTypeLabels,
} from "@/lib/labels";
import { vehicleStatusTone } from "@/lib/vehicle-ui";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatArs } from "@/lib/contract";
import { createMaintenance, deleteMaintenance } from "./maintenance-actions";
import { markDamageRepaired, deleteDamage } from "./damage-actions";
import { AddDamageForm } from "./add-damage-form";
import { archiveVehicle, unarchiveVehicle } from "../actions";

export const metadata: Metadata = { title: "Vehículo — Andes" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">{children}</h2>;
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      rentals: {
        orderBy: { startAt: "desc" },
        include: { inspections: { select: { type: true, km: true } } },
      },
      inspections: {
        orderBy: { createdAt: "asc" },
        include: {
          rental: { select: { clientName: true } },
          user: { select: { name: true } },
        },
      },
      damages: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          posX: true,
          posY: true,
          description: true,
          photoUrl: true,
          repaired: true,
          createdAt: true,
          repairedAt: true,
          reportedBy: { select: { name: true } },
          repairedBy: { select: { name: true } },
        },
      },
      maintenanceLogs: { orderBy: { date: "desc" } },
    },
  });
  if (!vehicle) notFound();

  const activeDamages = vehicle.damages.filter((d) => !d.repaired);

  const kmData = vehicle.inspections.map((i) => ({ km: i.km, label: formatDate(i.createdAt) }));
  const hasActiveRental = vehicle.status === "rented" || vehicle.rentals.some((r) => r.status === "active");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {vehicle.brand} {vehicle.model}
            </h1>
            <p className="text-sm text-foreground/60">{vehicle.plate}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone={vehicleStatusTone[vehicle.status]}>{vehicleStatusLabels[vehicle.status]}</Badge>
            {vehicle.archivedAt && <Badge tone="neutral">Archivado</Badge>}
          </div>
        </div>

        {vehicle.archivedAt && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            Este vehículo está archivado (baja de {formatDate(vehicle.archivedAt)}). No aparece en el
            dashboard, los listados operativos ni los QR. Su historial se conserva.
          </p>
        )}

        <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
          <Row label="Año" value={vehicle.year} />
          <Row label="Color" value={vehicle.color} />
          <Row label="Kilometraje" value={`${vehicle.currentKm.toLocaleString("es-AR")} km`} />
          <Row
            label="Próximo service"
            value={
              vehicle.nextServiceKm ? (
                <span className={vehicle.currentKm >= vehicle.nextServiceKm ? "text-red-600 dark:text-red-400" : undefined}>
                  {vehicle.nextServiceKm.toLocaleString("es-AR")} km
                  {vehicle.currentKm < vehicle.nextServiceKm
                    ? ` · faltan ${(vehicle.nextServiceKm - vehicle.currentKm).toLocaleString("es-AR")} km`
                    : " · vencido"}
                </span>
              ) : (
                "—"
              )
            }
          />
          <Row label="Intervalo de service" value={vehicle.serviceIntervalKm ? `${vehicle.serviceIntervalKm.toLocaleString("es-AR")} km` : "—"} />
          <Row label="Líneas de combustible" value={`${vehicle.fuelLevels} líneas`} />
          <Row label="Mapeo VikRentCar" value={vehicle.wpCarId ? `idcar ${vehicle.wpCarId} · unidad ${vehicle.wpCarIndex}` : "Sin mapear"} />
          <Row label="Notas" value={vehicle.notes} />
        </div>

        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/vehicles/${vehicle.id}/edit`}>Editar</ButtonLink>
          {isAdmin && (
            <ButtonLink href={`/vehicles/${vehicle.id}/qr`} variant="secondary">Imprimir QR</ButtonLink>
          )}
          <ButtonLink href="/vehicles" variant="secondary">Volver</ButtonLink>
          {isAdmin &&
            (vehicle.archivedAt ? (
              <form action={unarchiveVehicle.bind(null, vehicle.id)} className="ml-auto">
                <SubmitButton variant="secondary" pendingLabel="Reactivando…">Reactivar</SubmitButton>
              </form>
            ) : hasActiveRental ? (
              <span className="ml-auto self-center text-xs text-foreground/50">
                Para archivar, cerrá primero la devolución del alquiler activo.
              </span>
            ) : (
              <form action={archiveVehicle.bind(null, vehicle.id)} className="ml-auto">
                <SubmitButton variant="secondary" pendingLabel="Archivando…">Archivar</SubmitButton>
              </form>
            ))}
        </div>
      </div>

      {/* Evolución de km */}
      <section className="flex flex-col gap-2">
        <SectionTitle>Evolución del kilometraje</SectionTitle>
        <KmChart data={kmData} />
      </section>

      {/* Daños activos */}
      <section className="flex flex-col gap-2">
        <SectionTitle>Daños activos ({activeDamages.length})</SectionTitle>
        {activeDamages.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">Sin daños activos.</p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="mx-auto w-full max-w-[180px] shrink-0">
              <Croquis existing={activeDamages} markers={[]} readOnly />
            </div>
            <ul className="flex-1 divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
              {activeDamages.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    {d.photoUrl && (
                      <a
                        href={`/api/media?key=${encodeURIComponent(d.photoUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/media?key=${encodeURIComponent(d.photoUrl)}`}
                          alt={d.description || "Foto del daño"}
                          className="h-12 w-12 rounded-lg border border-foreground/10 object-cover"
                        />
                      </a>
                    )}
                    <span className="min-w-0">{d.description || "Daño sin descripción"}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <form action={markDamageRepaired.bind(null, vehicle.id, d.id)}>
                      <button className="text-xs font-medium text-emerald-600">Marcar reparado</button>
                    </form>
                    {isAdmin && (
                      <form action={deleteDamage.bind(null, vehicle.id, d.id)}>
                        <button className="text-xs text-red-600">Borrar</button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <details className="rounded-xl border border-foreground/10">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground/70">
            Agregar daño
          </summary>
          <div className="px-4 pb-4">
            <AddDamageForm vehicleId={vehicle.id} existing={activeDamages} />
          </div>
        </details>
      </section>

      {/* Historial de daños (activos + reparados, con auditoría) */}
      <section className="flex flex-col gap-2">
        <SectionTitle>Historial de daños ({vehicle.damages.length})</SectionTitle>
        {vehicle.damages.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">Sin daños registrados.</p>
        ) : (
          <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {vehicle.damages.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 font-medium">{d.description || "Daño sin descripción"}</span>
                  <Badge tone={d.repaired ? "neutral" : "amber"}>{d.repaired ? "Reparado" : "Activo"}</Badge>
                </div>
                <p className="text-xs text-foreground/50">
                  Cargado por {d.reportedBy?.name ?? "—"} · {formatDateTime(d.createdAt)}
                </p>
                {d.repaired && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Reparado por {d.repairedBy?.name ?? "—"}
                    {d.repairedAt ? ` · ${formatDateTime(d.repairedAt)}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Historial de alquileres */}
      <section className="flex flex-col gap-2">
        <SectionTitle>Historial de alquileres ({vehicle.rentals.length})</SectionTitle>
        {vehicle.rentals.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">Sin alquileres.</p>
        ) : (
          <div className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {vehicle.rentals.map((r) => {
              const h = r.inspections.find((i) => i.type === "handover");
              const ret = r.inspections.find((i) => i.type === "return_");
              const driven = h && ret ? ret.km - h.km : null;
              return (
                <Link key={r.id} href={`/rentals/${r.id}`} className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-foreground/[0.03]">
                  <div>
                    <p className="font-medium">{r.clientName}</p>
                    <p className="text-xs text-foreground/50">{formatDate(r.startAt)} → {formatDate(r.endAt)}</p>
                  </div>
                  <span className="text-foreground/60">{driven != null ? `${driven.toLocaleString("es-AR")} km` : "—"}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Historial de inspecciones */}
      <section className="flex flex-col gap-2">
        <SectionTitle>Inspecciones ({vehicle.inspections.length})</SectionTitle>
        {vehicle.inspections.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">Sin inspecciones.</p>
        ) : (
          <div className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {[...vehicle.inspections].reverse().map((insp) => (
              <div key={insp.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {insp.type === "handover" ? "Entrega" : "Devolución"} · {insp.km.toLocaleString("es-AR")} km
                  </p>
                  <p className="text-xs text-foreground/50">{insp.rental.clientName} · {formatDateTime(insp.createdAt)}</p>
                  <p className="text-xs text-foreground/50">Responsable: {insp.user?.name ?? "—"}</p>
                </div>
                <a className="font-medium underline" href={`/api/acta?inspectionId=${insp.id}`} target="_blank" rel="noopener noreferrer">
                  Acta
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mantenimiento */}
      <section className="flex flex-col gap-2">
        <SectionTitle>Mantenimiento</SectionTitle>

        <form action={createMaintenance.bind(null, vehicle.id)} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground/70">Tipo</span>
                <select name="type" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" defaultValue="service">
                  {Object.entries(maintenanceTypeLabels).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground/70">Fecha</span>
                <input type="date" name="date" required className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground/70">Km</span>
                <input type="number" name="km" inputMode="numeric" defaultValue={vehicle.currentKm} className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground/70">Costo</span>
                <input type="number" name="cost" inputMode="numeric" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
              </label>
            </div>
            <input name="place" placeholder="Lugar / taller (opcional)" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm" />
            <input name="description" required placeholder="Descripción (ej. cambio de aceite y filtros)" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm" />
            <SubmitButton pendingLabel="Agregando…">Agregar registro</SubmitButton>
          </form>

        {vehicle.maintenanceLogs.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">Sin registros de mantenimiento.</p>
        ) : (
          <div className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {vehicle.maintenanceLogs.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{maintenanceTypeLabels[m.type]}</Badge>
                    <span className="text-xs text-foreground/50">{formatDate(m.date)}{m.km != null ? ` · ${m.km.toLocaleString("es-AR")} km` : ""}</span>
                  </div>
                  <p className="mt-1">{m.description}</p>
                  {m.place && <p className="text-xs text-foreground/50">📍 {m.place}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {m.cost != null && <span className="font-medium">{formatArs(Number(m.cost))}</span>}
                  {isAdmin && (
                    <form action={deleteMaintenance.bind(null, vehicle.id, m.id)}>
                      <button className="text-xs text-red-600">Borrar</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
