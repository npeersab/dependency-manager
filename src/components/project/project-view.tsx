"use client";

import { useRouter } from "next/navigation";
import type { Project } from "@prisma/client";
import type { Dependency, Container } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/header";
import { EditProject } from "./edit-project";
import { CheckUpdatesButton } from "./check-updates-button";
import { DependencyTable } from "./dependency-table";
import { ContainerTable } from "@/components/project/container-table";

export function ProjectView({ project }: { project: Project & { dependencies: Dependency[]; containers: Container[] } }) {
  const router = useRouter();
  const onRefresh = () => router.refresh();

  return (
    <>
      <Header cta={<CheckUpdatesButton projectId={project.id} />} />
      <div className="mx-auto min-h-screen max-w-5xl px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <a href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to projects
          </a>
        </Button>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          {project.description && <p className="mt-1 text-muted-foreground">{project.description}</p>}
        </div>

        <EditProject project={project} />

        <div className="mt-6">
          <Tabs defaultValue="deps">
            <TabsList>
              <TabsTrigger value="deps">Dependencies</TabsTrigger>
              <TabsTrigger value="containers">Containers</TabsTrigger>
            </TabsList>
            <TabsContent value="deps" className="mt-4">
              <DependencyTable projectId={project.id} dependencies={project.dependencies} onAdded={onRefresh} />
            </TabsContent>
            <TabsContent value="containers" className="mt-4">
              <ContainerTable projectId={project.id} containers={project.containers} onAdded={onRefresh} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
