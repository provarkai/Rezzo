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

### WhatsApp

Set all four `WHATSAPP_*` variables to turn on the adapter (§14.2: WhatsApp as an acquisition channel — a customer can text REZZO to start a Case with no prior signup). Point a Meta WhatsApp Cloud API app's webhook at `GET`/`POST /api/v1/webhooks/whatsapp` (same tunnel requirement as Paystack for local testing). Unlike the Paystack integration, this hasn't been exercised against a live number — no WhatsApp test credentials were available while building it, only Meta's documented request/webhook shapes to build against. Text messages create or continue a Case the same way the app's home screen composer does; voice notes and images are acknowledged but not processed (no speech-to-text or image pipeline exists in this codebase to hand them to).

### Logging & Analytics

Every server-side log line goes through `src/lib/logger.ts` as a single JSON object on stdout (`{timestamp, level, message, ...context}`) — no log aggregator wired up, just a consistent shape most hosting platforms already ingest. `src/lib/analytics.ts`'s `trackEvent()` covers the PRD §22 funnel milestones (`need_created`, `quote_accepted`, `payment_confirmed`, `case_resolved`, `dispute_opened`) — it always logs structurally, and additionally forwards to PostHog when `POSTHOG_API_KEY` is set (untested against a live project, same as the WhatsApp adapter). The admin **Analytics** tab computes real conversion rates (quote rate, quote acceptance, payment conversion, dispute rate) and GMV/revenue/resolution-time from the underlying Case/Quote/Payment/Dispute data — it used to be a re-render of the Overview tab.

### Design Tokens

Brand colors are Tailwind utility classes (`bg-rezzo-navy`, `text-rezzo-green`, `bg-rezzo-gold`, `text-rezzo-danger`, `bg-rezzo-warning`) backed by CSS custom properties in `src/app/globals.css`. The token layer has existed since the transfer, but most of the app was written with raw arbitrary hex instead (`bg-[#102A43]`) — `rezzo-navy` in particular, the most-used brand color, had zero adoption before this pass. The shared `src/components/rezzo/*` primitives now use the tokens; the rest of the app (~30 page components, ~500 raw hex occurrences) is a known, documented gap — see the comment above `:root` in `globals.css` for the full picture and why a blind mechanical find-replace across every file wasn't the right call without a browser in this sandbox to verify against.

## Tests

`bun run test` (or `bun test`) runs the unit suite via Bun's built-in test runner — no extra dependency to install. It currently covers the pure, no-database logic: the case state machine (`isValidTransition`), password hashing, auth token signing/verification, and the Paystack/WhatsApp webhook signature verification. Nothing that touches Prisma is covered yet — that needs a real `bun install` + generated client, which wasn't available while writing this suite; see `worklog.md`/the gap-review artifact for what's still untested.

## Scripts

- `dev` — start the Next.js dev server
- `build` / `start` — production build/run
- `lint` — ESLint
- `test` — run the unit test suite (`bun test`)
- `db:push` / `db:generate` / `db:migrate` / `db:reset` — Prisma database tasks
