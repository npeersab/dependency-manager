import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/actions";
import { ProjectView } from "@/components/project/project-view";
import { ProjectViewSkeleton } from "@/components/project/project-view-skeleton";

export const metadata = {
  title: "Project",
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();
  return (
    <Suspense fallback={<ProjectViewSkeleton />}>
      <ProjectLoader id={numericId} />
    </Suspense>
  );
}

// Isolated so the Suspense boundary can stream skeletons while this awaits the
// DB query.
async function ProjectLoader({ id }: { id: number }) {
  const project = await getProject(id);
  if (!project) notFound();
  return <ProjectView project={project} />;
}
