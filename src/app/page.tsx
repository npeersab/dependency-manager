import { Suspense } from "react";
import { listProjects } from "@/lib/actions";
import { Header } from "@/components/header";
import { ProjectsGrid } from "@/components/project-grid";
import { ProjectGridSkeleton } from "@/components/project-grid-skeleton";
import { NewProjectButton, NewProjectModal, NewProjectProvider } from "@/components/project/new-project-modal";

export const metadata = {
  title: "Projects",
  description: "Manage your project dependencies and containers",
};

// Projects list reflects live DB writes, so it must not be statically cached.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  return (
    <NewProjectProvider>
      <Header cta={<NewProjectButton />} />

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

      <NewProjectModal />
    </NewProjectProvider>
  );
}

// Isolated so the Suspense boundary can stream skeletons while this awaits the
// DB, instead of blocking the whole page on the query.
async function ProjectsList() {
  const projects = await listProjects();
  return <ProjectsGrid projects={projects} />;
}
