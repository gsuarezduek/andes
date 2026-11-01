import { describe, expect, it } from "vitest";
import { autoInvoiceDecision, invoiceGroup, invoicedChangeError, type AutoInvoiceInput } from "../invoicing-rules";

const base: AutoInvoiceInput = {
  type: "income",
  deleted: false,
  isGuarantee: false,
  fromGuarantee: false,
  needsConfirmation: false,
  accountAutoInvoice: true,
  needsInvoice: false,
  invoiceAuto: false,
  invoiced: false,
};

describe("autoInvoiceDecision", () => {
  it("agrega un ingreso nuevo en una cuenta que factura sola", () => {
    expect(autoInvoiceDecision(base)).toBe("add");
  });

  it("no toca uno que ya está en Facturación", () => {
    expect(autoInvoiceDecision({ ...base, needsInvoice: true, invoiceAuto: true })).toBe("keep");
    expect(autoInvoiceDecision({ ...base, needsInvoice: true, invoiceAuto: false })).toBe("keep");
  });

  it("no agrega egresos, garantías, lo derivado de una garantía ni importados sin confirmar", () => {
    expect(autoInvoiceDecision({ ...base, type: "expense" })).toBe("keep");
    expect(autoInvoiceDecision({ ...base, isGuarantee: true })).toBe("keep");
    expect(autoInvoiceDecision({ ...base, fromGuarantee: true })).toBe("keep");
    expect(autoInvoiceDecision({ ...base, needsConfirmation: true })).toBe("keep");
    expect(autoInvoiceDecision({ ...base, deleted: true })).toBe("keep");
  });

  it("no agrega si la cuenta no factura sola", () => {
    expect(autoInvoiceDecision({ ...base, accountAutoInvoice: false })).toBe("keep");
  });

  it("saca lo que entró solo por la cuenta si cambió a otra que no factura", () => {
    expect(
      autoInvoiceDecision({ ...base, accountAutoInvoice: false, needsInvoice: true, invoiceAuto: true }),
    ).toBe("remove");
  });

  it("no saca lo pedido por el cliente o agregado a mano", () => {
    expect(
      autoInvoiceDecision({ ...base, accountAutoInvoice: false, needsInvoice: true, invoiceAuto: false }),
    ).toBe("keep");
  });

  it("nunca toca un ingreso ya facturado", () => {
    expect(
      autoInvoiceDecision({ ...base, accountAutoInvoice: false, needsInvoice: true, invoiceAuto: true, invoiced: true }),
    ).toBe("keep");
  });
});

describe("invoiceGroup", () => {
  it("es pedido de cliente si hay nombre o CUIT", () => {
    expect(invoiceGroup({ invoicingName: "Juan", invoicingCuit: null })).toBe("client");
    expect(invoiceGroup({ invoicingName: null, invoicingCuit: "20-1-3" })).toBe("client");
    expect(invoiceGroup({ invoicingName: "  ", invoicingCuit: null })).toBe("account");
    expect(invoiceGroup({ invoicingName: null, invoicingCuit: null })).toBe("account");
  });
});

describe("invoicedChangeError", () => {
  it("deja hacer cualquier cambio si no está facturado", () => {
    expect(invoicedChangeError(false, { account: true, delete: true })).toBeNull();
  });

  it("bloquea cuenta, monto, moneda y borrado si está facturado", () => {
    expect(invoicedChangeError(true, { account: true })).toMatch(/ya está facturado/);
    expect(invoicedChangeError(true, { amount: true })).toMatch(/ya está facturado/);
    expect(invoicedChangeError(true, { currency: true })).toMatch(/ya está facturado/);
    expect(invoicedChangeError(true, { delete: true })).toMatch(/no se puede eliminar/);
  });

  it("deja cambiar el detalle de uno facturado", () => {
    expect(invoicedChangeError(true, {})).toBeNull();
  });
});
