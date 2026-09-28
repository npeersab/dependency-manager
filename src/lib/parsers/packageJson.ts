import type { ParsedProject, ParsedDependency } from "../types";
import type { DepType } from "@prisma/client";

/** Parse a package.json into a de-duplicated list of npm dependencies. */
export function parsePackageJson(content: string): ParsedProject {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error("package.json is not valid JSON.");
  }

  const deps: ParsedDependency[] = [];
  const seen = new Set<string>();

  /** Strip npm range/comparison prefixes (^, ~, >=, >, v, …) to the base version. */
  const cleanVersion = (version: unknown): string => {
    const raw = String(version ?? "").trim();
    // Take the lower bound of a hyphen range (e.g. "2.0.8 - 2.9.9" → "2.0.8").
    const lowerBound = raw.split(" - ")[0];
    // Strip leading range/comparison operators and an optional leading "v".
    return lowerBound.replace(/^[v\s>=<~^]+/, "").trim();
  };

  const add = (name: string, version: unknown) => {
    if (seen.has(name)) return;
    seen.add(name);
    deps.push({ name, version: cleanVersion(version), type: "NPM" as DepType });
  };

  for (const section of ["dependencies", "devDependencies"]) {
    const map = data[section];
    if (!map || typeof map !== "object") continue;
    for (const [name, version] of Object.entries(map as Record<string, unknown>)) {
      add(name, version);
    }
  }

  return { dependencies: deps, containers: [] };
}
