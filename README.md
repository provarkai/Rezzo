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

Seed demo data (customers, professionals, admin, sample case) via `bun run db:seed` (see `prisma/seed.ts`), or by calling `POST /api/v1/seed` once you're authenticated as an admin.

### Demo accounts

Registration and login require a password (min. 8 characters) — there is no passwordless or role-self-assignment path, so admin accounts can only be created via the seed script. All seeded accounts share one password: `Rezzo@Demo123` (see `prisma/seed.ts`). This is a local/pilot sandbox convenience, not a real secret — don't reuse it, and don't seed these accounts against a database holding real user data.

| Role | Identifier | Password |
|---|---|---|
| Customer | `+2348012345678` | `Rezzo@Demo123` |
| Professional | `tunde@rezzo.ng` | `Rezzo@Demo123` |
| Admin | `admin@rezzo.ng` | `Rezzo@Demo123` |

### Payments

Without `PAYSTACK_SECRET_KEY` set, payments use a MOCK provider that self-confirms client-side — fine for demos, but nothing real ever moves. Set `PAYSTACK_SECRET_KEY` (a test key is enough for staging) to switch on real Paystack checkout: the customer is redirected to Paystack's hosted page, and confirmation happens only via Paystack's webhook, never a client click. Point the webhook at `POST /api/v1/payments/webhooks/paystack` in the Paystack dashboard (Settings → API Keys & Webhooks) for this to actually fire in a deployed environment — Paystack can't reach `localhost`, so local testing needs a tunnel (e.g. `ngrok http 3000`) with that URL registered instead.

## Scripts

- `dev` — start the Next.js dev server
- `build` / `start` — production build/run
- `lint` — ESLint
- `db:push` / `db:generate` / `db:migrate` / `db:reset` — Prisma database tasks
