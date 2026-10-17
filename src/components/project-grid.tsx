"use client";

import { useMemo, useState } from "react";
import type { Project } from "@prisma/client";
import { FolderOpen, Search } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { SearchInput } from "@/components/search-input";
import { NewProjectButton } from "@/components/project/new-project-modal";

export function ProjectsGrid({ projects }: { projects: Array<Project & { _count: { dependencies: number; containers: number } }> }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [projects, query]);

  return (
    <div className="mt-6 space-y-5">
      {projects.length > 0 && (
        <SearchInput value={query} onChange={setQuery} placeholder="Search projects" />
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project by hand or by uploading a pom.xml, package.json, or docker-compose file."
          action={<NewProjectButton />}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching projects"
          description={`No projects match “${query.trim()}”.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
