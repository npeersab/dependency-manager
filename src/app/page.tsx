import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { listProjects } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";

export const metadata = {
  title: "Projects",
  description: "Manage your project dependencies and containers",
};

// Projects list reflects live DB writes, so it must not be statically cached.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await listProjects();

  return (
    <div className="mx-auto min-h-screen px-4 py-8 max-w-5xl">
      <Header
        cta={
          <Button asChild>
            <Link href="/projects/new">+ New Project</Link>
          </Button>
        }
      />

      <div className="mt-8">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track dependencies and container images across your projects.</p>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project by hand or by uploading a pom.xml, package.json, or docker-compose file."
          action={
            <Button asChild>
              <Link href="/projects/new">+ New Project</Link>
            </Button>
          }
        />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
