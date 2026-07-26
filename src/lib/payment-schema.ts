import { z } from "zod";

/** Espeja `RentalPayment` (src/lib/contract.ts). Compartido entre saveHandover y saveReturn. */
export const paymentSchema = z.object({
  methodId: z.string().optional(),
  methodName: z.string(),
  adjustmentPercent: z.number().optional(),
  amount: z.number(),
  adjustedAmount: z.number(),
  note: z.string().optional(),
});
