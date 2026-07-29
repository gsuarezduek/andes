import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="ml-[calc(50%-50vw)] flex w-screen flex-col gap-4 px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-28" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-foreground/10">
        <div className="flex border-b border-foreground/10 p-2">
          <Skeleton className="h-4 w-16 shrink-0" />
          <div className="ml-4 flex flex-1 gap-6">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-8" />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-foreground/5 px-2 py-3 last:border-0">
            <Skeleton className="h-4 w-14 shrink-0" />
            <Skeleton className="h-6 flex-1 max-w-[45%]" />
          </div>
        ))}
      </div>
    </div>
  );
}
