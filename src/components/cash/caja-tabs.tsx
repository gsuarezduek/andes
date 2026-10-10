"use client";

import { Suspense, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { TabBar } from "@/components/ui/tabs";
import { CAJA_SECTIONS, type CajaSectionKey } from "./caja-sections";

/**
 * Caja partida en pestañas: "Movimientos" (Ingreso/Egreso), "Asociados"
 * (resumen por asociado), "Cuentas corrientes" (ex-"Proveedores", cuenta
 * corriente por proveedor), "Garantías" (depósitos tomados/devueltos, ver
 * `RentalPayment.isGuarantee`) y "Saldos" (ex-"Cuentas propias": saldo +
 * historial de cada cuenta propia, cada una en su propia página — solo
 * admin, ver abajo) y "Facturación" (ingresos marcados "Hay que facturar" +
 * el libro de facturas cargadas). La Caja fuerte ya no tiene pestaña propia:
 * es una tarjeta más dentro de Saldos (v44, ver `AccountsSection`). Las
 * primeras tres, "Garantías" y "Facturación" son visibles para cualquier rol
 * (lo que cada una muestra por dentro ya varía por rol, ver `caja/page.tsx`);
 * "Saldos" directamente no se pasa (queda `undefined`) para un no-admin, así
 * que ni su pestaña aparece — es la posición de plata real de la empresa. Ya
 * vienen renderizadas desde el server component; acá solo se elige cuál
 * mostrar (mismo patrón que RentalDetailTabs).
 *
 * Pestaña inicial: lee `?tab=` (ver `CajaSectionNav`, usado en las páginas de
 * detalle de proveedor/asociado/cuenta) para poder volver directo a la
 * sección de la que se vino, en vez de siempre abrir en "Movimientos".
 */
export function CajaTabs(props: {
  movimientos: ReactNode;
  asociados: ReactNode;
  proveedores: ReactNode;
  garantias?: ReactNode;
  facturacion?: ReactNode;
  saldos?: ReactNode;
}) {
  return (
    <Suspense fallback={<CajaTabsContent {...props} initialTab={null} />}>
      <CajaTabsWithInitialTab {...props} />
    </Suspense>
  );
}

function CajaTabsWithInitialTab(props: {
  movimientos: ReactNode;
  asociados: ReactNode;
  proveedores: ReactNode;
  garantias?: ReactNode;
  facturacion?: ReactNode;
  saldos?: ReactNode;
}) {
  const searchParams = useSearchParams();
  return <CajaTabsContent {...props} initialTab={searchParams.get("tab")} />;
}

function CajaTabsContent({
  movimientos,
  asociados,
  proveedores,
  garantias,
  facturacion,
  saldos,
  initialTab,
}: {
  movimientos: ReactNode;
  asociados: ReactNode;
  proveedores: ReactNode;
  garantias?: ReactNode;
  facturacion?: ReactNode;
  saldos?: ReactNode;
  initialTab: string | null;
}) {
  const panels: Partial<Record<CajaSectionKey, ReactNode>> = {
    movimientos,
    asociados,
    proveedores,
    garantias,
    facturacion,
    saldos,
  };
  const entries = CAJA_SECTIONS.filter((s) => panels[s.key] !== undefined);
  const initialIndex = Math.max(
    0,
    entries.findIndex((e) => e.key === initialTab),
  );
  const [section, setSection] = useState(initialIndex);

  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={entries.map((e) => e.label)} active={section} onChange={setSection} />
      {panels[entries[section]?.key ?? "movimientos"]}
    </div>
  );
}
