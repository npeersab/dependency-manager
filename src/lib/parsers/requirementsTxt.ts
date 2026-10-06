import type { ParsedProject, ParsedDependency } from "../types";
import type { DepType } from "@prisma/client";
import { normalizePipName } from "../image";

/**
 * Parse a requirements.txt into a de-duplicated list of Python dependencies.
 *
 * Handles the common specifier forms (`==`, `>=`, `<=`, `~=`, `!=`, `===`, bare
 * version), extras (`pkg[extra]`), environment markers (`; python_version >=
 * "3.7"`), comments and blank lines, and skips pip options (`-r`, `-e`,
 * `--hash`, `--index-url`) and VCS/URL lines. Versions are reduced to the lower
 * bound of the first specifier (e.g. ">=1.0,<2.0" → "1.0").
 */
export function parseRequirementsTxt(content: string): ParsedProject {
  const deps: ParsedDependency[] = [];
  const seen = new Set<string>();

  /** Strip a comma-separated specifier list down to a plain base version. */
  const cleanVersion = (spec: string | null): string => {
    if (!spec) return "unknown";
    // Keep the first specifier — the lower bound of a range like ">=1.0,<2.0".
    const first = spec.split(",")[0].trim();
    // Strip leading comparison operators (==, >=, <=, ~=, !=, ===, >, <).
    const withoutOps = first.replace(/^[!<>~=]+/, "").trim();
    // Lower bound of a hyphen range ("1.0 - 2.0" → "1.0").
    const lowerBound = withoutOps.split(" - ")[0].trim();
    // Strip an optional leading "v"; nothing left means an unpinned package.
    return lowerBound.replace(/^v/, "").trim() || "unknown";
  };

  const add = (rawName: string, spec: string | null) => {
    const name = normalizePipName(rawName);
    if (!name) return;
    // Dedupe on the normalized name so "Flask", "flask" and "flask_" collapse.
    if (seen.has(name)) return;
    seen.add(name);
    deps.push({ name, version: cleanVersion(spec), type: "PYTHON" as DepType });
  };

  for (const rawLine of content.split(/\r?\n/)) {
    let token = rawLine.trim();
    if (!token) continue;

    // Cut comments. Per PEP 508 a "#" only starts a comment when preceded by
    // whitespace, so we never strip a "#" that is mid-token (e.g. in a URL).
    const hashIdx = token.indexOf("#");
    if (hashIdx === 0) continue;
    if (hashIdx > 0) token = token.slice(0, hashIdx).trim();
    if (!token) continue;

    // Skip pip options (-r, -e, --hash, --index-url) and VCS/editable/URL lines.
    if (token.startsWith("-") || token.startsWith("git+")) continue;
    if (/^[a-z0-9]+:\/\//i.test(token)) continue;

    // Drop environment markers: "pkg==1.0 ; python_version >= '3.7'".
    const semi = token.indexOf(";");
    if (semi >= 0) token = token.slice(0, semi).trim();

    // Strip extras: "pkg[extra1,extra2]==1.0" → "pkg==1.0".
    const lb = token.indexOf("[");
    const rb = token.indexOf("]");
    if (lb >= 0 && rb > lb) token = `${token.slice(0, lb)}${token.slice(rb + 1)}`;
    if (!token) continue;

    // The version specifier is everything after the package name; if a
    // comma-separated list is present, keep only the first specifier.
    const comma = token.indexOf(",");
    const firstSpec = comma >= 0 ? token.slice(0, comma) : token;
    const m = firstSpec.match(/^([A-Za-z0-9_.-]+)\s*(.*)$/);
    if (!m) continue;
    add(m[1], m[2].trim());
  }

  return { dependencies: deps, containers: [] };
}
