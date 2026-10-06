"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Project } from "@prisma/client";
import type { Dependency, Container } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Header } from "@/components/header";
import { EditProject } from "./edit-project";
import { CheckUpdatesButton } from "./check-updates-button";
import { DependencyTable } from "./dependency-table";
import { ContainerTable } from "@/components/project/container-table";

export function ProjectView({ project }: { project: Project & { dependencies: Dependency[]; containers: Container[] } }) {
  const router = useRouter();
  const onRefresh = () => router.refresh();
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const defaultTab = project.dependencies.length > 0 ? "deps" : "containers";

  return (
    <>
      <Header
        cta={
          <CheckUpdatesButton
            projectId={project.id}
            onProgress={(checked, total) => setProgress(total > 0 ? (checked / total) * 100 : 0)}
            onSettle={setChecking}
          />
        }
      />

      {/* Full-width progress strip pinned just below the sticky header. */}
      {checking && (
        <Progress
          value={progress}
          aria-label="Checking for updates"
          className="sticky top-14 z-30 h-1 w-full"
        />
      )}

      <div className="mx-auto min-h-screen max-w-5xl px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to projects
          </Link>
        </Button>

        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <EditProject project={project} />
          </div>
          {project.description && <p className="mt-1 text-muted-foreground">{project.description}</p>}
        </div>

        <div className="mt-6">
          <Tabs defaultValue={defaultTab}>
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
