import { Skeleton } from "@/components/ui/skeleton";

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="mt-1.5 h-3.5 w-3/5" />
        <Skeleton className="mt-1.5 h-3 w-1/3" />
      </div>
      <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-11 w-32" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-11 w-20" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-24" />
        <div className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-24" />
        <div className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </section>
    </div>
  );
}
