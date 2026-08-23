"use client";

import { useState } from "react";
import { SelectField } from "@/components/ui/fields";

/**
 * "Cuenta" + "Tipo de cuenta ajena" del alta de un medio de pago nuevo — el
 * segundo select solo tiene sentido (y solo se muestra) cuando la primera
 * elección es "Cuenta ajena". Mismo par de campos que ya existe por fila en
 * `PaymentMethodsEditor`, acá para el form de alta (sin drafts, un solo par).
 */
export function OwnershipFields() {
  const [ownership, setOwnership] = useState<"own" | "third_party">("own");

  return (
    <>
      <SelectField
        id="ownership"
        label="Cuenta"
        required
        value={ownership}
        onChange={(e) => setOwnership(e.target.value as "own" | "third_party")}
      >
        <option value="own">Cuenta propia</option>
        <option value="third_party">Cuenta ajena (proveedor/empleado)</option>
      </SelectField>
      {ownership === "third_party" && (
        <SelectField
          id="thirdPartyKind"
          label="Tipo de cuenta ajena"
          hint="Solo Proveedor habilita cuenta corriente (deuda) en Caja."
          defaultValue=""
        >
          <option value="">Sin clasificar</option>
          <option value="employee">Empleado</option>
          <option value="provider">Proveedor</option>
        </SelectField>
      )}
    </>
  );
}
