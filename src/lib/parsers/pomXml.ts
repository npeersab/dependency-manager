import { XMLParser } from "fast-xml-parser";
import type { ParsedProject, ParsedDependency } from "../types";
import type { DepType } from "@prisma/client";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false, // keep versions like "1.0" as strings
  trimValues: true,
});

interface PomParent {
  groupId?: string;
  artifactId?: string;
  version?: string;
}

interface PomRoot {
  project?: {
    properties?: Record<string, unknown>;
    parent?: PomParent;
  };
}

/**
 * Recursively collect every Maven <dependency> element.
 *
 * fast-xml-parser represents each <dependency> element as a value under the key
 * "dependency". Tracking the parent key lets us collect only real dependency
 * entries (including those inside <dependencyManagement>) while ignoring the
 * root <project> element, which also carries groupId/artifactId/version.
 */
function findDependencies(node: unknown, out: Record<string, string>[], parentKey?: string) {
  if (Array.isArray(node)) {
    for (const item of node) findDependencies(item, out, parentKey);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (parentKey === "dependency" && typeof obj.groupId === "string" && typeof obj.artifactId === "string") {
      out.push(obj as unknown as Record<string, string>);
    }
    for (const [key, value] of Object.entries(obj)) {
      findDependencies(value, out, key);
    }
  }
}

/** Parse a pom.xml into a de-duplicated list of Maven dependencies. */
export function parsePomXml(content: string): ParsedProject {
  let root: unknown;
  try {
    root = parser.parse(content);
  } catch {
    throw new Error("pom.xml is not valid XML.");
  }

  // Collect <properties> for ${...} resolution.
  const props: Record<string, string> = {};
  const propsNode = (root as PomRoot)?.project?.properties;
  if (propsNode && typeof propsNode === "object") {
    for (const [k, v] of Object.entries(propsNode)) {
      props[k] = String(v);
    }
  }

  const resolve = (value: string | undefined): string => {
    if (!value) return "";
    return value.replace(/\$\{([^}]+)\}/g, (_match, key: string) => props[key] ?? "");
  };

  // Resolve the parent POM coordinates. A dependency that omits its own version
  // inherits it from the parent (Maven resolves ${...} in the parent too), so we
  // keep the parent's resolved version as a fallback below.
  const parentNode = (root as PomRoot)?.project?.parent;
  const parent =
    parentNode && typeof parentNode === "object"
      ? {
          groupId: resolve(String((parentNode as PomParent).groupId ?? "")),
          artifactId: resolve(String((parentNode as PomParent).artifactId ?? "")),
          version: resolve(String((parentNode as PomParent).version ?? "")),
        }
      : { groupId: "", artifactId: "", version: "" };

  const rawDeps: Record<string, string>[] = [];
  findDependencies(root, rawDeps);

  const deps: ParsedDependency[] = [];
  const seen = new Set<string>();
  for (const dep of rawDeps) {
    const groupId = resolve(dep.groupId);
    const artifactId = resolve(dep.artifactId);
    // Prefer the dependency's own (variable-resolved) version; fall back to the
    // parent's resolved version when the dependency declares none.
    const version = resolve(dep.version) || parent.version || "unknown";
    const name = `${groupId}:${artifactId}`;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    deps.push({ name, version: version || "unknown", type: "MAVEN" as DepType });
  }

  return { dependencies: deps, containers: [] };
}
