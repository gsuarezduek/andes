import "server-only";
import { NextResponse } from "next/server";

/** Escapa un valor para CSV (comillas dobles, comas, saltos de línea). */
function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Respuesta CSV descargable (BOM para que Excel abra los acentos bien). */
export function csvResponse(rows: (string | number)[][], filename: string): NextResponse {
  const csv = "﻿" + toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
