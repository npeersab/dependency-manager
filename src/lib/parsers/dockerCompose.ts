import { load } from "js-yaml";
import type { ParsedProject, ParsedContainer } from "../types";
import { splitImage } from "../image";

/**
 * Parse a docker-compose.yml into a de-duplicated list of containers.
 * Only services with an explicit `image:` become containers; digest-pinned
 * images (@sha256:) are skipped (they are managed by digest, not tag).
 */
export function parseDockerCompose(content: string): ParsedProject {
  let data: Record<string, unknown> = {};
  try {
    const parsed = load(content) || {};
    data = parsed as Record<string, unknown>;
  } catch {
    throw new Error("docker-compose.yml is not valid YAML.");
  }

  const services = data.services;
  if (!services || typeof services !== "object") {
    return { dependencies: [], containers: [] };
  }

  const containers: ParsedContainer[] = [];
  const seen = new Set<string>();

  for (const cfg of Object.values(services)) {
    if (!cfg || typeof cfg !== "object") continue;
    const image = (cfg as { image?: unknown }).image;
    if (typeof image !== "string" || !image) continue;

    const ref = splitImage(image);
    if (ref.pinned) continue;
    // Preserve the registry prefix (ghcr.io/, quay.io/) so the stored reference
    // resolves against the correct registry. Without this, `ghcr.io/o/app` would
    // be stored as `o/app` and mis-queried as a Docker Hub image.
    const registryPrefix =
      ref.registry === "ghcr" ? "ghcr.io/" : ref.registry === "quay" ? "quay.io/" : "";
    const storedImage = `${registryPrefix}${ref.namespace}/${ref.repo}`;
    const key = `${storedImage}:${ref.tag}`;
    if (seen.has(key)) continue;
    seen.add(key);
    containers.push({ image: storedImage, tag: ref.tag });
  }

  return { dependencies: [], containers };
}
