/**
 * Registry clients that fetch the latest version for a dependency or container.
 * Each returns the latest *stable* tag/version, or null on any failure.
 * Network access is assumed (single local user on a connected machine).
 */
import { splitImage, isStable, compareVersions, normalizeGithubRepo, normalizePipName } from "./image";

const TIMEOUT_MS = 10_000;

async function httpJson(url: string, headers: Record<string, string> = {}): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getToken(url: string): Promise<string | null> {
  const data = await httpJson(url);
  return (data?.token as string | undefined) ?? null;
}

/** Latest published version of an npm package (handles @scope/pkg). */
export async function getNpmLatest(name: string): Promise<string | null> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
  const data = await httpJson(url);
  const versions = data?.versions as Record<string, { version: string }> | undefined;
  const distTags = data?.["dist-tags"] as Record<string, unknown> | undefined;

  // The `latest` dist-tag can point at a pre-release (Prisma publishes
  // 8.0.0-rc.19 as its latest), so scan the published versions and keep the
  // highest *stable* one — the same "latest stable" rule used for container
  // tags — rather than trusting the dist-tag blindly.
  let latestStable: string | null = null;
  for (const v of Object.values(versions ?? {})) {
    if (!isStable(v.version)) continue;
    if (latestStable === null || compareVersions(v.version, latestStable) > 0) latestStable = v.version;
  }

  // No stable version published at all: fall back to the dist-tag when it looks
  // stable, so a package that only ever ships pre-releases still reports
  // something instead of failing.
  if (latestStable === null) {
    const distLatest = (distTags?.latest as string | undefined) ?? null;
    return distLatest && isStable(distLatest) ? distLatest : null;
  }

  return latestStable;
}

/** Latest version of a Maven artifact (name is "groupId:artifactId"). */
export async function getMavenLatest(name: string): Promise<string | null> {
  const [groupId, artifactId] = name.split(":");
  if (!groupId || !artifactId) return null;
  const q = `g:${groupId} AND a:${artifactId}`;
  const url = `https://search.maven.org/solrsearch/select?q=${encodeURIComponent(q)}&rows=1&wt=json`;
  const data = await httpJson(url);
  const response = data?.response as { docs?: Array<Record<string, unknown>> } | undefined;
  const doc = response?.docs?.[0];
  return (doc?.latestVersion as string | undefined) ?? null;
}

/** Latest published version of a Python package (queries the PyPI JSON API). */
export async function getPyLatest(name: string): Promise<string | null> {
  const url = `https://pypi.org/pypi/${normalizePipName(name)}/json`;
  const data = await httpJson(url);
  const versions = data?.releases as Record<string, unknown> | undefined;

  // Same "highest stable" rule as npm: scan every published version and keep the
  // highest *stable* one rather than trusting `info.latest_version`, which for
  // some distributions points at a pre-release.
  let latestStable: string | null = null;
  for (const v of Object.keys(versions ?? {})) {
    if (!isStable(v)) continue;
    if (latestStable === null || compareVersions(v, latestStable) > 0) latestStable = v;
  }

  if (latestStable === null) {
    // No stable version at all: fall back to `info.latest_version` when it looks
    // stable, so a package that only ships pre-releases still reports something.
    const info = data?.info as { latest_version?: string } | undefined;
    const latest = info?.latest_version;
    return latest && isStable(latest) ? latest : null;
  }

  return latestStable;
}

// ---------------------------------------------------------------------------
// Container tags.
//
// Registries return tags in their own order and cap each page, so we fetch one
// page and take the highest *stable* tag from it:
//   - Docker Hub orders by last_updated desc, so the newest tags are on page 1.
//   - ghcr.io orders by creation asc, so the newest release tags can be buried
//     far past the first page behind commit/pr/sha tags (e.g. immich v3.2.2 sits
//     among ~100k tags). We never paginate to chase them — see getDockerLatest.
//   - quay.io returns active tags, newest first.
// ---------------------------------------------------------------------------

async function getGhcrTags(repoPath: string): Promise<string[] | null> {
  const token = await getToken(`https://ghcr.io/token?service=ghcr.io&scope=repository:${repoPath}:pull`);
  if (!token) return null;
  const data = await httpJson(`https://ghcr.io/v2/${repoPath}/tags/list?n=100`, {
    Authorization: `Bearer ${token}`,
  });
  return (data?.tags as string[] | undefined) ?? null;
}

async function getQuayTags(repoPath: string): Promise<string[] | null> {
  const token = await getToken(`https://quay.io/api/v1/token?repository=${repoPath}&action=pull`);
  if (!token) return null;
  const data = await httpJson(`https://quay.io/api/v1/repository/${repoPath}/tag/?limit=100&onlyActiveTags=true`, {
    Authorization: `Bearer ${token}`,
  });
  if (!data) return null;
  const tags = data.tags as Record<string, unknown>[] | undefined;
  return (tags ?? []).map((t) => t.name as string);
}

async function getDockerHubTags(repoPath: string): Promise<string[] | null> {
  const data = await httpJson(`https://hub.docker.com/v2/repositories/${repoPath}/tags/?page_size=100`);
  if (!data) return null;
  const results = data.results as Record<string, unknown>[] | undefined;
  return (results ?? []).map((r) => r.name as string);
}

export interface LatestResult {
  /** Stable tag to display as "latest", or null when none could be determined. */
  latest: string | null;
  /** True when a newer stable tag than the pinned one was found. */
  isUpdatable: boolean;
}

/**
 * Resolve the latest stable tag for a container and whether it is newer than the
 * pinned tag. `currentTag` is the tag pinned in the compose file / project.
 *
 * Because a single registry page may not contain the newest release (ghcr hides
 * it behind thousands of commit tags), we never report a "latest" that is lower
 * than the pinned tag: if nothing newer than the pinned tag is visible we treat
 * the container as up to date and surface the pinned tag itself, so the "latest"
 * column never reads below "current" for busy registries. If the pinned tag is a
 * pre-release newer than any stable tag we can see, we fall back to the highest
 * stable tag seen, since this reports the latest *stable* release.
 */
export async function getDockerLatest(image: string, currentTag: string): Promise<LatestResult> {
  const ref = splitImage(image);
  // Docker Hub's API v2 always needs the full namespace path, e.g.
  // "library/nginx" for official images (bare "nginx" returns "object not found").
  const repoPath = `${ref.namespace}/${ref.repo}`;

  let tags: string[] | null = null;
  if (ref.registry === "ghcr") {
    tags = await getGhcrTags(repoPath);
  } else if (ref.registry === "quay") {
    tags = await getQuayTags(repoPath);
  } else {
    tags = await getDockerHubTags(repoPath);
  }

  // The registry call itself failed (network error, timeout, or a repo path the
  // API rejected). Surface this as a failure rather than reporting the pinned
  // tag as current — a failed lookup must never read as "up to date".
  if (tags === null) {
    return { latest: null, isUpdatable: false };
  }

  // Highest *stable* tag we could actually see on the page we fetched.
  let latestVisible: string | null = null;
  for (const t of tags) {
    if (!isStable(t)) continue;
    if (latestVisible === null || compareVersions(t, latestVisible) > 0) latestVisible = t;
  }

  // The registry worked but the page had no stable tag. Fall back to the pinned
  // tag if it looks stable, so we still show something sensible instead of blank.
  if (latestVisible === null) {
    return { latest: isStable(currentTag) ? currentTag : null, isUpdatable: false };
  }

  const cmp = compareVersions(latestVisible, currentTag);
  if (cmp > 0) {
    // A newer stable release is visible → update available.
    return { latest: latestVisible, isUpdatable: true };
  }

  // Nothing newer than the pinned tag is visible → no update available. Surface
  // the pinned tag itself (when it is stable) so the "latest" column never reads
  // below the version you are running. If the pinned tag is a pre-release newer
  // than any stable tag we could see, fall back to the highest stable tag seen,
  // since this reports the latest *stable* release.
  return {
    latest: isStable(currentTag) ? currentTag : latestVisible,
    isUpdatable: false,
  };
}

// ---------------------------------------------------------------------------
// ghcr.io -> GitHub source repo.
//
// ghcr.io is GitHub's own container registry, so a ghcr.io/<org>/<name> image
// almost always maps to github.com/<org>/<name>. We infer that repo and read the
// true latest from the GitHub Releases API (exact, forward-looking). A few images
// publish under a ghcr name that differs from their release repo — see
// GHCR_REPO_OVERRIDES — and any image whose inferred repo 404s is surfaced as a
// failure rather than silently mis-resolved. Non-ghcr images fall back to
// getDockerLatest above.
// ---------------------------------------------------------------------------

/** In-memory cache of repo -> latest resolution, keyed by "owner/repo". */
const ghCache = new Map<string, { resolution: GithubResolution; ts: number }>();
const GH_CACHE_MS = 60 * 60 * 1000; // 1h: matches GitHub's unauthenticated window

const GHCR_REPO_OVERRIDES: Record<string, string> = {
  "immich-app/immich-server": "immich-app/immich",
  "immich-app/immich-machine-learning": "immich-app/immich",
};

/**
 * Resolve the github.com "<owner>/<repo>" for a ghcr.io image, or null for
 * non-ghcr images (those fall back to getDockerLatest). Uses the ghcr->GitHub
 * convention, with a small overrides list for images whose ghcr name differs
 * from their release repo.
 */
export function getGithubRepoFromImage(image: string): string | null {
  const ref = splitImage(image);
  if (ref.registry !== "ghcr") return null;
  const key = `${ref.namespace}/${ref.repo}`;
  return GHCR_REPO_OVERRIDES[key] ?? key;
}

async function ghJson(url: string): Promise<{ status: number; body: Record<string, unknown> | null }> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "dependency-manager",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Return the status even on a non-2xx response so callers can tell a real
    // 404 (repo doesn't exist) apart from a transient 403/network error.
    if (!res.ok) return { status: res.status, body: null };
    return { status: res.status, body: await res.json() };
  } catch {
    return { status: 0, body: null };
  }
}

/**
 * Resolution of a GitHub repo's latest release.
 *  - "found": the repo exists. `tag` is null when it exists but has no stable
 *    release or stable tags.
 *  - "notFound": the repo doesn't exist (HTTP 404) — our ghcr→GitHub inference
 *    produced a name with no matching repo.
 */
type GithubResolution =
  | { kind: "found"; tag: string | null }
  | { kind: "notFound" };

/**
 * Resolve github.com/<owner>/<repo>'s latest stable release. Uses the
 * /releases/latest endpoint, falling back to the newest stable tag when a repo
 * publishes tags but no releases. Returns a "notFound" result on a 404 so the
 * caller can tell a wrong ghcr→GitHub mapping apart from a repo that merely has
 * no releases. Results are cached to stay under GitHub's 60 req/hr
 * unauthenticated limit and to avoid repeated calls for images that share a
 * repo (e.g. immich-server + immich-machine-learning).
 */
async function getGithubLatest(repo: string): Promise<GithubResolution> {
  const cached = ghCache.get(repo);
  if (cached && Date.now() - cached.ts < GH_CACHE_MS) return cached.resolution;

  const rel = await ghJson(`https://api.github.com/repos/${repo}/releases/latest`);
  let tag: string | null = (rel.body?.tag_name as string | undefined) ?? null;

  if (!tag) {
    const data = await ghJson(`https://api.github.com/repos/${repo}/tags?per_page=30`);
    const list = (data.body?.tags as Array<{ name: string }> | undefined) ?? [];
    for (const t of list) {
      if (isStable(t.name)) {
        tag = t.name;
        break;
      }
    }
  }

  // Cache only definitive outcomes: a real tag, or a 404 that proves the repo
  // doesn't exist. A 403 (rate limit) or network error is transient — leave it
  // uncached (as "found, no tag") so the next check re-tries instead of
  // remembering a false empty repo.
  if (tag) {
    const res: GithubResolution = { kind: "found", tag };
    ghCache.set(repo, { resolution: res, ts: Date.now() });
    return res;
  }
  if (rel.status === 404) {
    const res: GithubResolution = { kind: "notFound" };
    ghCache.set(repo, { resolution: res, ts: Date.now() });
    return res;
  }
  return { kind: "found", tag: null };
}

/**
 * Resolve latest stable + updatable flag for a *known* github.com owner/repo.
 * Shared by the inferred mapping and the explicit per-container override paths.
 * A 404 (repo doesn't exist) is surfaced as a failure rather than falling back
 * to the inferior tag-list method; a repo with no stable release falls back to
 * it.
 */
async function latestFromGithubRepo(
  repo: string,
  image: string,
  currentTag: string,
): Promise<LatestResult> {
  const res = await getGithubLatest(repo);
  if (res.kind === "found") {
    const gh = res.tag;
    if (gh) {
      // gh is the authoritative latest release from GitHub. Report it as
      // "latest"; an update is available only when it is strictly newer than
      // the pinned tag. A pinned pre-release or build newer than the last
      // release is simply "up to date" — we never surface a non-existent tag
      // as the latest, even when it reads above the true release.
      return { latest: gh, isUpdatable: compareVersions(gh, currentTag) > 0 };
    }
    // Repo exists but has no stable release. Fall back to the tag-list method,
    // which may still see stable tags the Releases API doesn't surface.
    return getDockerLatest(image, currentTag);
  }
  // Repo 404'd — the mapping (inferred or explicit) is wrong. Surface this as a
  // failure instead of silently falling back to the (inferior, possibly-wrong)
  // tag-list method.
  return { latest: null, isUpdatable: false };
}

/**
 * Resolve the latest stable tag for a container and whether it is newer than
 * the pinned tag. For ghcr.io images we resolve the source GitHub repo and read
 * the true latest from the GitHub Releases API (exact, forward-looking, no
 * Docker required); otherwise this falls back to the registry tag-list hybrid
 * in getDockerLatest.
 *
 * `githubRepo` is an optional explicit override pinned to this container for a
 * ghcr.io image whose ghcr name differs from its release repo. When set it takes
 * precedence over the inferred mapping and the global overrides list; it is
 * ignored for non-ghcr images.
 */
export async function getContainerLatest(
  image: string,
  currentTag: string,
  githubRepo?: string | null,
): Promise<LatestResult> {
  const ref = splitImage(image);
  const override = ref.registry === "ghcr" ? normalizeGithubRepo(githubRepo ?? "") : "";
  if (override) return latestFromGithubRepo(override, image, currentTag);

  const repo = getGithubRepoFromImage(image);
  if (repo) return latestFromGithubRepo(repo, image, currentTag);

  return getDockerLatest(image, currentTag);
}
