import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton shown by the Suspense boundary on the projects list while it awaits the DB. */
export function ProjectGridSkeleton() {
  return (
    <div className="mt-6 space-y-5">
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-4 rounded-xl border bg-background p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
