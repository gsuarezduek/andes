import { Row } from "@/components/ui/row";
import { formatArs } from "@/lib/contract";

export function PaymentsSection({
  hasContract,
  totalRef,
  paidSoFar,
  balance,
}: {
  hasContract: boolean;
  totalRef: number | null;
  paidSoFar: number | null;
  balance: number | null;
}) {
  return (
    <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
      <Row label={hasContract ? "Total" : "Total (ref. VikRentCar)"} value={totalRef != null ? formatArs(totalRef) : null} />
      <Row label={hasContract ? "Pagado" : "Pagado (VikRentCar)"} value={paidSoFar != null ? formatArs(paidSoFar) : null} />
      <Row label="Saldo" value={balance != null ? formatArs(balance) : null} />
    </div>
  );
}
