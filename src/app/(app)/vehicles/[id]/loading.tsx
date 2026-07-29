import { Skeleton } from "@/components/ui/skeleton";

function SectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3.5 w-40" />
      <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full max-w-md" />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>

      <SectionSkeleton rows={1} />

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-foreground/10 p-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-11 w-32" />
        <Skeleton className="h-11 w-32" />
        <Skeleton className="h-11 w-32" />
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>

      <SectionSkeleton rows={2} />
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={2} />
      <SectionSkeleton rows={2} />
    </div>
  );
}
