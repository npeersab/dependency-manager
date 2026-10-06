"use server";

import { prisma } from "./prisma";
import { compareVersions, normalizeGithubRepo } from "./image";
import { getNpmLatest, getMavenLatest, getPyLatest, getContainerLatest } from "./registries";
import type { DepType, Source } from "@prisma/client";

/** Latest-version resolver per dependency type, keyed by {@link DepType}. */
const LATEST_BY_TYPE: Partial<Record<DepType, (name: string) => Promise<string | null>>> = {
  NPM: getNpmLatest,
  MAVEN: getMavenLatest,
  PYTHON: getPyLatest,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  name: string;
  description?: string;
  dependencies?: Array<{ name: string; version: string; type: DepType }>;
  containers?: Array<{ image: string; tag: string }>;
}

export interface CheckSummary {
  checked: number;
  updatable: number;
  upToDate: number;
  failed: number;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { dependencies: true, containers: true } },
    },
  });
}

export async function getProject(id: number) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      dependencies: { orderBy: { name: "asc" } },
      containers: { orderBy: [{ image: "asc" }, { tag: "asc" } ] },
    },
  });
}

export async function createProject(input: CreateProjectInput) {
  const project = await prisma.project.create({
    data: {
      name: input.name,
      description: input.description || null,
      dependencies: {
        create: (input.dependencies ?? []).map((d) => ({
          name: d.name,
          version: d.version,
          type: d.type,
          source: "MANUAL" as Source,
        })),
      },
      containers: {
        create: (input.containers ?? []).map((c) => ({
          image: c.image,
          tag: c.tag,
          source: "MANUAL" as Source,
        })),
      },
    },
    include: {
      dependencies: true,
      containers: true,
    },
  });

  // De-duplicate against members that already exist in this project.
  await dedupeProject(project.id);
  return getProject(project.id);
}

export async function updateProject(id: number, data: { name?: string; description?: string }) {
  return prisma.project.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
    },
  });
}

export async function deleteProject(id: number) {
  await prisma.project.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Add members to an existing project (used by edit-mode upload)
// ---------------------------------------------------------------------------

export interface AddMembersInput {
  dependencies?: Array<{ name: string; version: string; type: DepType }>;
  containers?: Array<{ image: string; tag: string }>;
}

/**
 * Sync members to a project for edit-mode upload.
 * New members are created; members that already exist have their version
 * overridden with the one from the uploaded file (no duplicates — the existing
 * row is updated in place rather than skipped).
 */
export async function addMembers(projectId: number, input: AddMembersInput) {
  const result = {
    addedDependencies: 0,
    updatedDependencies: 0,
    addedContainers: 0,
    updatedContainers: 0,
  };

  for (const dep of input.dependencies ?? []) {
    const existing = await prisma.dependency.findFirst({ where: { projectId, name: dep.name } });
    if (existing) {
      await prisma.dependency.update({ where: { id: existing.id }, data: { version: dep.version, type: dep.type } });
      result.updatedDependencies++;
    } else {
      await prisma.dependency.create({
        data: { projectId, name: dep.name, version: dep.version, type: dep.type, source: "UPLOADED" },
      });
      result.addedDependencies++;
    }
  }

  for (const c of input.containers ?? []) {
    const existing = await prisma.container.findFirst({ where: { projectId, image: c.image } });
    if (existing) {
      await prisma.container.update({ where: { id: existing.id }, data: { tag: c.tag } });
      result.updatedContainers++;
    } else {
      await prisma.container.create({
        data: { projectId, image: c.image, tag: c.tag, source: "UPLOADED" },
      });
      result.addedContainers++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export async function addDependency(
  projectId: number,
  dep: { name: string; version: string; type: DepType },
) {
  return prisma.dependency.create({
    data: {
      projectId,
      name: dep.name,
      version: dep.version,
      type: dep.type,
      source: "MANUAL",
    },
  });
}

export async function updateDependency(
  id: number,
  data: { name?: string; version?: string; type?: DepType },
) {
  return prisma.dependency.update({ where: { id }, data });
}

export async function deleteDependency(id: number) {
  await prisma.dependency.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

export async function addContainer(
  projectId: number,
  container: { image: string; tag: string; githubRepo?: string | null },
) {
  return prisma.container.create({
    data: {
      projectId,
      image: container.image,
      tag: container.tag,
      githubRepo: container.githubRepo ? normalizeGithubRepo(container.githubRepo) : null,
      source: "MANUAL",
    },
  });
}

export async function updateContainer(
  id: number,
  data: { image?: string; tag?: string; githubRepo?: string | null },
) {
  return prisma.container.update({
    where: { id },
    data: {
      ...(data.image !== undefined && { image: data.image }),
      ...(data.tag !== undefined && { tag: data.tag }),
      ...(data.githubRepo !== undefined && {
        githubRepo: data.githubRepo ? normalizeGithubRepo(data.githubRepo) : null,
      }),
    },
  });
}

export async function deleteContainer(id: number) {
  await prisma.container.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// De-duplication + update checks
// ---------------------------------------------------------------------------

/** Remove duplicate members within a project, keeping the first of each group. */
async function dedupeProject(projectId: number) {
  const deps = await prisma.dependency.findMany({ where: { projectId } });
  const seenDeps = new Set<string>();
  for (const d of deps) {
    if (seenDeps.has(d.name)) {
      await prisma.dependency.delete({ where: { id: d.id } });
    } else {
      seenDeps.add(d.name);
    }
  }

  const containers = await prisma.container.findMany({ where: { projectId } });
  const seenContainers = new Set<string>();
  for (const c of containers) {
    const key = `${c.image}:${c.tag}`;
    if (seenContainers.has(key)) {
      await prisma.container.delete({ where: { id: c.id } });
    } else {
      seenContainers.add(key);
    }
  }
}

/** Progress callback invoked after each member of a project is checked. */
export type CheckProgressCallback = (progress: { checked: number; total: number }) => void;

/**
 * Query every member of a project for its latest version, persist the result,
 * and return a summary. Failures are recorded, never fatal.
 *
 * `onProgress` is invoked after each member completes (used to drive a
 * streaming UI); it is optional, so the plain server-action wrapper keeps
 * working unchanged. `total` is fixed up front from the member counts.
 */
export async function runCheckUpdates(
  projectId: number,
  onProgress?: CheckProgressCallback,
): Promise<CheckSummary> {
  const [deps, containers] = await Promise.all([
    prisma.dependency.findMany({ where: { projectId } }),
    prisma.container.findMany({ where: { projectId } }),
  ]);

  const summary: CheckSummary = { checked: 0, updatable: 0, upToDate: 0, failed: 0 };
  const total = deps.length + containers.length;
  const now = new Date();

  for (const dep of deps) {
    summary.checked++;
    const resolver = LATEST_BY_TYPE[dep.type];
    const latest = resolver ? await resolver(dep.name) : null;
    if (!latest) {
      summary.failed++;
      onProgress?.({ checked: summary.checked, total });
      continue;
    }
    const isUpdatable = compareVersions(latest, dep.version) > 0;
    await prisma.dependency.update({
      where: { id: dep.id },
      data: { latestVersion: latest, lastCheckedAt: now, isUpdatable },
    });
    if (isUpdatable) summary.updatable++;
    else summary.upToDate++;
    onProgress?.({ checked: summary.checked, total });
  }

  for (const c of containers) {
    summary.checked++;
    const { latest, isUpdatable } = await getContainerLatest(c.image, c.tag, c.githubRepo);
    if (!latest) {
      summary.failed++;
      onProgress?.({ checked: summary.checked, total });
      continue;
    }
    await prisma.container.update({
      where: { id: c.id },
      data: { latestVersion: latest, lastCheckedAt: now, isUpdatable },
    });
    if (isUpdatable) summary.updatable++;
    else summary.upToDate++;
    onProgress?.({ checked: summary.checked, total });
  }

  return summary;
}

/**
 * Check a project for updates and return a summary. Thin wrapper over
 * {@link runCheckUpdates} with no progress callback, used as a server action.
 */
export async function checkUpdates(projectId: number): Promise<CheckSummary> {
  return runCheckUpdates(projectId);
}

/** Check a single dependency and persist the result. Returns latest version or null. */
export async function checkDependency(id: number): Promise<string | null> {
  const dep = await prisma.dependency.findUnique({ where: { id } });
  if (!dep) return null;
  const resolver = LATEST_BY_TYPE[dep.type];
  const latest = resolver ? await resolver(dep.name) : null;
  if (!latest) return null;
  const isUpdatable = compareVersions(latest, dep.version) > 0;
  await prisma.dependency.update({
    where: { id },
    data: { latestVersion: latest, lastCheckedAt: new Date(), isUpdatable },
  });
  return latest;
}

/** Check a single container and persist the result. Returns latest tag or null. */
export async function checkContainer(id: number): Promise<string | null> {
  const c = await prisma.container.findUnique({ where: { id } });
  if (!c) return null;
  const { latest, isUpdatable } = await getContainerLatest(c.image, c.tag, c.githubRepo);
  if (!latest) return null;
  await prisma.container.update({
    where: { id },
    data: { latestVersion: latest, lastCheckedAt: new Date(), isUpdatable },
  });
  return latest;
}
