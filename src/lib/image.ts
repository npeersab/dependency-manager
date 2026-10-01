/**
 * Docker image parsing + stable-tag helpers.
 * The stable-tag rules are ported from ~/docker/check-all-updates.py so the
 * web app recommends the same "latest stable" the existing checker does.
 */

export type RegistryType = "dockerhub" | "ghcr" | "quay";

export interface ImageRef {
  registry: RegistryType;
  /** "library" for Docker Hub public images, or the org/namespace. */
  namespace: string;
  repo: string;
  tag: string;
  /** True when the image is pinned by content digest (@sha256:). */
  pinned: boolean;
}

/**
 * Public registry page for a dependency, so a table cell can link out to it.
 * NPM packages live on npmjs.com; Maven artifacts are best viewed on the
 * mvnrepository.com artifact page, which keeps groupId:artifactId as-is.
 */
export function dependencyLink(name: string, type: "NPM" | "MAVEN"): string {
  if (type === "MAVEN") {
    const [groupId, artifactId] = name.split(":");
    if (!groupId || !artifactId) return "";
    return `https://mvnrepository.com/artifact/${groupId}/${artifactId}`;
  }
  return `https://www.npmjs.com/package/${name}`;
}

/**
 * Split a reference like `registry/namespace/repo:tag` into its parts.
 * Handles Docker Hub (default), ghcr.io and quay.io, plus digest pins.
 */
export function splitImage(image: string): ImageRef {
  let ref = image;
  let pinned = false;
  if (ref.includes("@sha256:")) {
    pinned = true;
    ref = ref.split("@")[0];
  }

  // Separate the tag (a colon after the last slash only).
  let tag = "latest";
  const lastColon = ref.lastIndexOf(":");
  if (lastColon > ref.lastIndexOf("/")) {
    tag = ref.slice(lastColon + 1);
    ref = ref.slice(0, lastColon);
  }

  const parts = ref.split("/");
  let registry: RegistryType = "dockerhub";
  let namespace: string;
  let repo: string;

  if (parts.length === 1) {
    namespace = "library";
    repo = parts[0];
  } else if (parts.length === 2) {
    if (parts[0] === "ghcr.io") {
      registry = "ghcr";
      const sub = parts[1].split("/");
      namespace = sub[0];
      repo = sub[1];
    } else if (parts[0] === "quay.io") {
      registry = "quay";
      const sub = parts[1].split("/");
      namespace = sub[0];
      repo = sub[1];
    } else {
      namespace = parts[0];
      repo = parts[1];
    }
  } else {
    // registry/namespace/repo...
    if (parts[0] === "ghcr.io") {
      registry = "ghcr";
      namespace = parts[1];
      repo = parts.slice(2).join("/");
    } else if (parts[0] === "quay.io") {
      registry = "quay";
      namespace = parts[1];
      repo = parts.slice(2).join("/");
    } else {
      // A non-special registry prefix (e.g. lscr.io/) means the image lives on
      // Docker Hub under the next two segments. Match check-all-updates.py, which
      // strips the prefix and queries Docker Hub {namespace}/{repo}.
      namespace = parts[1];
      repo = parts.slice(2).join("/");
    }
  }

  return { registry, namespace, repo, tag, pinned };
}

/** Display label for an image (image + tag). */
export function imageLabel(image: string, tag: string): string {
  return tag === "latest" ? image : `${image}:${tag}`;
}

/**
 * Public registry page for an image, so a table cell can link out to it.
 * `splitImage` already resolves the registry + namespace + repo, and it strips
 * non-special prefixes (e.g. lscr.io) to Docker Hub — so the link points at the
 * registry the image actually lives on.
 */
export function imageLink(image: string): string {
  const ref = splitImage(image);
  const path = `${ref.namespace}/${ref.repo}`;
  switch (ref.registry) {
    case "ghcr":
      return `https://ghcr.io/${path}`;
    case "quay":
      return `https://quay.io/repository/${path}`;
    default:
      return `https://hub.docker.com/r/${path}`;
  }
}

const DEV_KEYWORDS = [
  "canary",
  "nightly",
  "testing",
  "develop",
  "unstable",
  "-dev",
  "alpha",
  "beta",
  "-rc",
  "latest",
];

/**
 * A tag is "stable" if it looks like a semantic version (X.Y or X.Y.Z) and is
 * not a dev/pre-release tag. Ported from check-all-updates.py::is_stable.
 */
export function isStable(tag: string): boolean {
  const lower = tag.toLowerCase();

  for (const kw of DEV_KEYWORDS) {
    if (kw.startsWith("-")) {
      if (lower.includes(kw)) return false;
    } else {
      const pattern = new RegExp(`(?<![a-zA-Z0-9])${kw}(?![a-zA-Z0-9])`, "i");
      if (pattern.test(lower)) return false;
    }
  }

  // Reject date-based tags (8+ consecutive digits).
  if (/\d{8,}/.test(tag)) return false;

  const parts = tag.replace(/^v/, "").split(".");
  if (parts.length < 2 || parts.length > 3) return false;

  const knownSuffixes = ["-alpha", "-beta", "-rc", "-dev"];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i < parts.length - 1) {
      if (!/^\d+$/.test(part)) return false;
    } else {
      if (/^\d+$/.test(part)) return true;
      if (knownSuffixes.some((suf) => part.endsWith(suf) && new RegExp(`^\\d+${suf}$`).test(part))) {
        return false;
      }
      return false;
    }
  }
  return true;
}

/** Strip a leading "v" for display / comparison. */
export function stripV(v: string): string {
  return v.replace(/^v/, "");
}

/**
 * Normalize a user-entered GitHub repo reference to "<owner>/<repo>".
 * Accepts "owner/repo" directly, or a full github.com URL / clone string, and
 * returns anything else trimmed so callers can validate before use.
 */
export function normalizeGithubRepo(input: string): string {
  const v = input.trim();
  const match = v.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/);
  if (!match) return v;
  return `${match[1]}/${match[2].replace(/\.git$/, "")}`;
}

/**
 * Compare two semver-ish strings, ignoring a leading "v" and pre-release
 * suffixes. Returns -1, 0 or 1. Ported from the reference script's base-version
 * comparison.
 */
export function compareVersions(a: string, b: string): number {
  const norm = (v: string) => v.replace(/^v/, "").split(/[-+]/)[0].split(".").map((n) => Number.parseInt(n, 10) || 0);
  const x = norm(a);
  const y = norm(b);
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) {
    const xn = x[i] ?? 0;
    const yn = y[i] ?? 0;
    if (xn !== yn) return xn < yn ? -1 : 1;
  }
  return 0;
}
