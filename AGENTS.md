# AGENTS.md

Next.js 16 (App Router) + TypeScript, Prisma 7 + SQLite, shadcn/ui + Tailwind. Single local user, no auth. Manages project dependencies (npm/Maven) and Docker containers: CRUD, file-based project creation (pom.xml/package.json/docker-compose.yml), and a "Check for updates" flow that queries registries and persists latest versions.

## Commands
- Dev server: `PORT=8123 npm run dev` — **port 8123, not 3000** (3000 is occupied on this machine; the README still says 3000 and is stale).
- Build (this also typechecks): `npm run build`
- Lint: `npm run lint` (ESLint with the Next.js config; `next lint` is removed in Next 15+, so use `npm run lint`, not `next lint`). No test suite is configured.
- Prisma: DB is SQLite at `prisma/dev.db` (`.env` → `DATABASE_URL="file:./prisma/dev.db"`). The CLI reads `prisma7.config.ts` automatically, so `npx prisma ...` works (the `prisma7` binary is just an alias). Run `npx prisma generate` after **any** schema change so the client (generated to `src/generated/prisma`, gitignored) sees new fields/tables; add a migration with `npx prisma migrate dev` when the schema changes.
- Serve production build: `PORT=8123 npx next start` (kill any existing listener on 8123 first).

## Architecture
- Routes: `/` (projects list), `/projects/[id]` (view), `/projects/new` (create).
- Data is fetched in server components via `src/lib/actions.ts` (server actions → Prisma). Client components mutate data and must call `router.refresh()` afterward so the server-rendered UI reflects it (`project-card.tsx`, `check-updates-button.tsx`, `dependency-table.tsx`/`container-table.tsx`). Edit-mode save instead does a full `window.location.reload()`.
- `src/lib/` is the real logic: `actions.ts` (all server actions + dedupe/update-check), `parsers/` (in-memory file parsing), `registries.ts` + `image.ts` (registry lookups + version logic), `prisma.ts` (singleton client).
- `src/components/project/` = per-project UI; `src/components/ui/` = shadcn primitives.

## Gotchas (non-obvious)
- **`export const dynamic = "force-dynamic"` on `/`.** The projects list reflects live DB writes; do not remove it or the list caches stale data.
- **Uploads are in-memory only.** Uploaded files are parsed client-side and never written to disk/server.
- **Edit-mode upload overrides; new-project create dedupes.** `addMembers` (edit-mode save) updates an existing member in place: dependencies by **name**, containers by **image** (so the tag is overridden). `createProject` → `dedupeProject` skips duplicates on initial creation. Re-uploading one image under multiple tags collapses to the last tag seen.
- **npm versions are cleaned on parse** — range prefixes stripped (`^1.4.0`/`~2.0.8` → `1.4.0`); hyphen ranges take the lower bound.
- **pom.xml parser** resolves `${...}` from `<properties>` and parent-inherited versions, and only collects elements whose parent is `<dependency>` (so the root `<project>` coordinates are excluded).
- **Identities:** dependency = `name` (unique per project); container = `image:tag` (unique per project).
- **"Latest" = highest *stable* tag, not the first.** Registries return tags in their own order (not by version), so the code scans a single fetched page and keeps the highest stable tag (`isStable`); it never paginates to chase newer releases (ghcr.io buries them behind thousands of commit/PR tags). Docker Hub official images need the `library/` prefix in the API path (handled by `splitImage`/`getDockerLatest`). ghcr.io images resolve via the GitHub Releases API — `getContainerLatest` maps `ghcr.io/<org>/<name>` → `github.com/<org>/<name>` (overrides for `immich-*` in `GHCR_REPO_OVERRIDES`), and a per-container `githubRepo` override (schema field) takes precedence when the ghcr name differs from the release repo. Supported registries: Docker Hub, ghcr.io, quay.io. All registry calls need network access and time out at 10s.
- **docker-compose parser stores the image `splitImage` produces** (`src/lib/image.ts`), never reconstruct it by hand. For ghcr.io/quay.io that includes the registry prefix (`ghcr.io/immich-app/immich-server`); dropping it (storing `namespace/repo`) makes such an image resolve as Docker Hub and the check silently 404s.
- **Digest-pinned images are skipped.** docker-compose parser ignores `image@sha256:...` (managed by digest, not a mutable tag); only tagged images become containers.
- **lscr.io (and other non-special registry prefixes) are stripped to Docker Hub.** `splitImage` treats a 3-part reference like `lscr.io/linuxserver/sonarr` as Docker Hub `linuxserver/sonarr` — it drops the prefix and queries the remaining `{namespace}/{repo}`. This matches `~/docker/check-all-updates.py`; ghcr.io/quay.io are the only registries handled specially.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
