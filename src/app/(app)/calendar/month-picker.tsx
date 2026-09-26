"use client";

import { useRouter } from "next/navigation";

/** Selector de mes que navega apenas se elige (sin botón "Ver mes"). */
export function MonthPicker({ value }: { value: string | null }) {
  const router = useRouter();
  return (
    <input
      type="month"
      name="month"
      defaultValue={value ?? undefined}
      aria-label="Elegir mes"
      onChange={(e) => {
        if (e.target.value) router.push(`/calendar?month=${e.target.value}`);
      }}
      className="h-9 min-w-0 flex-1 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40 sm:w-40 sm:flex-none"
    />
  );
}
