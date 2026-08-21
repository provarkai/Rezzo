# Rezzo

REZZO — Nigeria V1: an AI-powered resolution network connecting customers with verified professionals across Property & Housing, Business & Enterprise, Home & Technical, and Government & Documentation. Built with Next.js, Prisma (SQLite), and shadcn/ui.

See `worklog.md` for a running build log of what has been implemented.

## Getting started

```bash
bun install          # or npm/yarn/pnpm install
cp .env.example .env
bun run db:generate
bun run db:push
bun run dev           # http://localhost:3000
```

Seed demo data (customers, professionals, admin, sample case) by calling `POST /api/v1/seed` (admin-only once auth is set up), or via `prisma/seed.ts`.

## Scripts

- `dev` — start the Next.js dev server
- `build` / `start` — production build/run
- `lint` — ESLint
- `db:push` / `db:generate` / `db:migrate` / `db:reset` — Prisma database tasks
