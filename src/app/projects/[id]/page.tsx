import { notFound } from "next/navigation";
import { getProject } from "@/lib/actions";
import { ProjectView } from "@/components/project/project-view";

export const metadata = {
  title: "Project",
};

export default async function ProjectPage({ params: { id } }: { params: { id: string } }) {
  const project = await getProject(Number(id));
  if (!project) notFound();
  return <ProjectView project={project} />;
}
