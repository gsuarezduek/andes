import { z } from "zod";

/** Espeja `RentalPayment` (src/lib/contract.ts). Compartido entre saveHandover y saveReturn. */
export const paymentSchema = z.object({
  methodId: z.string().optional(),
  methodName: z.string(),
  adjustmentPercent: z.number().optional(),
  amount: z.number().positive(),
  adjustedAmount: z.number().positive(),
  note: z.string().optional(),
  cashMovementId: z.string().optional(),
  unconfirmed: z.boolean().optional(),
  isGuarantee: z.boolean().optional(),
  usdAmount: z.number().positive().optional(),
  exchangeRate: z.number().positive().optional(),
  needsInvoice: z.boolean().optional(),
  invoicingName: z.string().trim().min(1).max(200).optional(),
  invoicingCuit: z.string().trim().min(1).max(20).optional(),
});
