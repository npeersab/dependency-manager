import { notFound } from "next/navigation";
import { getProject } from "@/lib/actions";
import { ProjectView } from "@/components/project/project-view";

export const metadata = {
  title: "Project",
};

export default async function ProjectPage({ params: { id } }: { params: { id: string } }) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();
  const project = await getProject(numericId);
  if (!project) notFound();
  return <ProjectView project={project} />;
}
