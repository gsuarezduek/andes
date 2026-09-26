import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  R2_FREE_TIER_BYTES,
  formatBytes,
  getDatabaseUsage,
  getFileUsage,
} from "@/lib/cloud-usage";

export const metadata: Metadata = { title: "Nube — Andes" };
export const dynamic = "force-dynamic";

function UsageBar({ ratio }: { ratio: number }) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const tone = ratio >= 0.9 ? "bg-red-500" : ratio >= 0.7 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-foreground/10"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function CloudSettingsPage() {
  await requireAdmin();

  const [db, files] = await Promise.all([
    getDatabaseUsage(),
    getFileUsage().catch(() => null),
  ]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nube</h1>
        <p className="text-sm text-foreground/60">
          Cuánto espacio usa la base de datos y el almacenamiento de archivos.
        </p>
      </div>

      {/* Archivos */}
      <section className="flex flex-col gap-4">
        <SectionHeading description="Fotos, videos, firmas, documentos y actas PDF, guardados en Cloudflare R2.">
          Archivos (Cloudflare R2)
        </SectionHeading>

        {files === null ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
            No se pudo consultar R2. Revisá las credenciales en Railway.
          </p>
        ) : !files.available ? (
          <p className="rounded-xl border border-foreground/10 p-4 text-sm text-foreground/60">
            Este entorno no tiene R2 configurado (los archivos se guardan en disco local).
          </p>
        ) : (
          <div className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-4">
            <div>
              <p className="text-2xl font-bold">{formatBytes(files.totalBytes)}</p>
              <p className="text-sm text-foreground/60">
                de {formatBytes(R2_FREE_TIER_BYTES)} del plan gratuito ·{" "}
                {files.totalObjects.toLocaleString("es-AR")} archivos
              </p>
            </div>
            <UsageBar ratio={files.totalBytes / R2_FREE_TIER_BYTES} />
            <ul className="flex flex-col divide-y divide-foreground/10 text-sm">
              {files.categories.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-3 py-2">
                  <span>{c.name}</span>
                  <span className="text-foreground/60">
                    {c.objects.toLocaleString("es-AR")} · {formatBytes(c.bytes)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-foreground/50">
              Plan gratuito de R2: 10 GB de almacenamiento, 1 millón de operaciones de escritura
              y 10 millones de lectura por mes; la descarga de datos no tiene costo. Pasado el
              límite no se corta: se cobra por lo excedente (unos USD 0,015 por GB al mes).
            </p>
          </div>
        )}
      </section>

      {/* Base de datos */}
      <section className="flex flex-col gap-4">
        <SectionHeading description="PostgreSQL en Railway: reservas, inspecciones, Caja, WhatsApp, etc.">
          Base de datos
        </SectionHeading>
        <div className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-4">
          <div>
            <p className="text-2xl font-bold">{formatBytes(db.totalBytes)}</p>
            <p className="text-sm text-foreground/60">Tamaño total de la base</p>
          </div>
          <p className="text-sm font-medium">Tablas más pesadas</p>
          <ul className="flex flex-col divide-y divide-foreground/10 text-sm">
            {db.tables.map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-3 py-2">
                <span className="font-mono text-xs">{t.name}</span>
                <span className="text-foreground/60">
                  ~{t.rows.toLocaleString("es-AR")} filas · {formatBytes(t.bytes)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-foreground/50">
            El límite de la base depende de tu plan de Railway (se factura por uso, no hay un tope
            fijo de tamaño). El conteo de filas es una estimación de PostgreSQL.
          </p>
        </div>
      </section>

      <div>
        <ButtonLink href="/settings" variant="secondary">Volver</ButtonLink>
      </div>
    </div>
  );
}
