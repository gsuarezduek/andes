"use client";

import { useState } from "react";
import { formatMoney, formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Row } from "@/components/ui/row";
import { priceCheckStatusDisplay } from "@/lib/competitor-prices/display";
import type { ComparisonData, ComparisonCell } from "@/lib/competitor-prices/comparison";

type Detail = { competitorName: string; categoryLabel: string; cell: ComparisonCell };

/** Tabla Categoría × Competidor. Click en una celda abre el detalle (fecha de
 *  consulta, fechas del alquiler, fuente, estado) en un modal. */
export function ComparisonTable({ data }: { data: ComparisonData }) {
  const [detail, setDetail] = useState<Detail | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-foreground/10">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-xs uppercase tracking-wide text-foreground/50">
              <th className="px-4 py-2">Categoría</th>
              <th className="px-4 py-2 text-right">Nosotros</th>
              {data.competitors.map((c) => (
                <th key={c.id} className="px-4 py-2 text-right">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.categoryId} className="border-b border-foreground/5 last:border-0">
                <td className="px-4 py-3 font-medium">
                  {row.categoryLabel}
                  {row.deltaPercent != null ? (
                    <span
                      className={`ml-2 text-xs font-normal ${row.deltaPercent > 0 ? "text-red-600" : "text-emerald-600"}`}
                    >
                      {row.deltaPercent > 0 ? "+" : ""}
                      {row.deltaPercent.toFixed(0)}% vs. competencia
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.ourPrice != null ? formatArs(row.ourPrice) : "—"}
                </td>
                {data.competitors.map((c) => {
                  const cell = row.cells[c.id];
                  if (!cell) {
                    return (
                      <td key={c.id} className="px-4 py-3 text-right text-foreground/30">
                        —
                      </td>
                    );
                  }
                  const display = priceCheckStatusDisplay(cell.status);
                  return (
                    <td key={c.id} className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDetail({ competitorName: c.name, categoryLabel: row.categoryLabel, cell })}
                        className="inline-flex items-center gap-1.5 tabular-nums hover:underline"
                      >
                        <span>{cell.price != null ? formatMoney(cell.price, cell.currency ?? "ars") : "—"}</span>
                        <Badge tone={display.tone}>{display.label}</Badge>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={2 + data.competitors.length} className="px-4 py-6 text-center text-sm text-foreground/50">
                  No hay categorías configuradas todavía.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={detail != null}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.competitorName} — ${detail.categoryLabel}` : undefined}
      >
        {detail ? (
          <div className="flex flex-col divide-y divide-foreground/10">
            <Row
              label="Precio"
              value={detail.cell.price != null ? formatMoney(detail.cell.price, detail.cell.currency ?? "ars") : "—"}
            />
            <Row label="Estado" value={priceCheckStatusDisplay(detail.cell.status).label} />
            <Row label="Fecha de consulta" value={formatDateTime(detail.cell.checkedAt)} />
            <Row label="Retiro" value={formatDateTime(detail.cell.pickupDate)} />
            <Row label="Devolución" value={formatDateTime(detail.cell.returnDate)} />
            {detail.cell.sourceUrl ? (
              <a
                href={detail.cell.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="pt-3 text-sm font-medium text-foreground underline"
              >
                Ver fuente original →
              </a>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
