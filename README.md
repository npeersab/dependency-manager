# Dependency Manager

A small local web app for tracking the dependencies and Docker containers of your projects — and keeping them up to date.

It manages two kinds of things per project:

- **Dependencies** — npm (`package.json`) and Maven (`pom.xml`) packages, tracked by name.
- **Containers** — Docker images from Docker Hub, `ghcr.io`, and `quay.io`, tracked by `image:tag`.

You can create a project by uploading the relevant files (`package.json`, `pom.xml`, `docker-compose.yml`), or by filling in a form. A **Check for updates** flow queries the source registries and records the latest available version for each dependency and container.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + TypeScript
- [Prisma 7](https://www.prisma.io) + SQLite
- [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS](https://tailwindcss.com)
- Single local user, no authentication

## Getting started

```bash
npm install
```

Apply migrations (creates the schema) and generate the Prisma client:

```bash
npx prisma migrate deploy   # or: npx prisma migrate dev
npx prisma generate
```

Copy the example env file and adjust if needed:

```bash
cp .env.example .env
```

Run the development server (on port **8123**):

```bash
PORT=8123 npm run dev
```

Open [http://localhost:8123](http://localhost:8123) in your browser.

### Building for production

```bash
npm run build     # also typechecks
npm run lint      # ESLint
PORT=8123 npx next start
```

## How it works

- **Projects** live at `/`, per-project views at `/projects/[id]`, and creation at `/projects/new`.
- Data is fetched in server components (`src/lib/actions.ts` → Prisma). Client components mutate data and call `router.refresh()` so the server-rendered UI stays in sync.
- **File parsing** (`src/lib/parsers/`) reads `package.json`, `pom.xml`, and `docker-compose.yml` in memory — uploaded files are parsed client-side and never written to disk.
- **Update checks** (`src/lib/registries.ts`, `src/lib/image.ts`) look up the latest version from each registry. "Latest" means the highest *stable* tag, not the first one returned.

## Configuration

| Variable     | Description                          | Default          |
| ------------ | ------------------------------------ | ---------------- |
| `DATABASE_URL` | SQLite database location           | `file:./prisma/dev.db`  |
| `PORT`       | Port for the dev/production server   | `8123`           |

## Project structure

```
prisma/
  schema.prisma      # Database schema
  migrations/        # Prisma migrations
src/
  app/               # App Router routes
  components/        # UI (shadcn) and per-project components
  lib/               # Core logic: actions, parsers, registries, prisma
```

## Contributing

Developer setup, commands, and gotchas live in [AGENTS.md](AGENTS.md) — read it before editing (dev server runs on port **8123**, the Prisma client is generated to `src/generated/prisma`, and uploads are parsed in-memory only).

## License

Private.
