import Link from "next/link";
import { Suspense } from "react";
import { listProjects } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { ProjectsGrid } from "@/components/project-grid";
import { ProjectGridSkeleton } from "@/components/project-grid-skeleton";

export const metadata = {
  title: "Projects",
  description: "Manage your project dependencies and containers",
};

// Projects list reflects live DB writes, so it must not be statically cached.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  return (
    <>
      <Header
        cta={
          <Button asChild>
            <Link href="/projects/new">+ New Project</Link>
          </Button>
        }
      />

      <div className="mx-auto min-h-screen max-w-5xl px-4 py-8">
        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track dependencies and container images across your projects.
          </p>
        </div>

        <Suspense fallback={<ProjectGridSkeleton />}>
          <ProjectsList />
        </Suspense>
      </div>
    </>
  );
}

// Isolated so the Suspense boundary can stream skeletons while this awaits the
// DB, instead of blocking the whole page on the query.
async function ProjectsList() {
  const projects = await listProjects();
  return <ProjectsGrid projects={projects} />;
}
