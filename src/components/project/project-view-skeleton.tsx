import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton shown by the Suspense boundary on a project page while it awaits the DB. */
export function ProjectViewSkeleton() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <Skeleton className="mb-4 h-9 w-40" />
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="mb-4 h-10 w-64" />
      <Skeleton className="mb-2 h-4 w-32" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-12 w-full" />
      ))}
    </div>
  );
}
