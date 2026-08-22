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

### Customer + Professional accounts

A single login serves both sides of the marketplace. Every non-admin account can act as a customer; applying via `POST /api/v1/professionals/apply` (now reachable in-app — "Become a Professional" in the customer profile screen, `ProfessionalApply`) adds a Professional record on top without removing that — `User.role` and `User.professional` are independent (role only distinguishes ADMIN elsewhere in the codebase, e.g. `requireRole: ['ADMIN']`). An account with both lands on a "Continue as Customer / Continue as Professional" chooser right after login (`AccountModeChooser`); a single-identity account skips it entirely. Only one mode is active per session — switching (via the "Switch account" action in each side's profile screen) clears the chosen mode and returns to the chooser rather than showing both at once. This replaces the previous behavior, where the customer view became permanently unreachable the moment `role` flipped to `PROFESSIONAL` on verification approval — a real bug, not just a UX gap: `verifyApplication`'s role update had no corresponding way back.

A submitted application starts at `verificationStatus: PENDING` and stays inactive — `isVerificationActive()` in `constants.ts` — until an admin reviews it in the Professional Queue (§`AdminProfessionalQueue`). "Inactive" is enforced, not just implied: the matching engine already excluded non-active professionals from auto-routing, and quote submission (`POST /cases/[id]/quotes`) now checks the same thing — it previously only checked that a Professional record existed at all, so a freshly-applied professional could submit real quotes before anyone reviewed them. Until approved, `ProfessionalApp` shows `ProfessionalVerificationStatus` (a staged progress view, refetched live, listing each submitted credential's own status) instead of the real dashboard.

Review itself is per-credential: `POST /admin/verification/[id]/credentials/[credentialId]` (`reviewCredential()` in `verification.ts`) verifies or rejects one submitted credential at a time and recomputes the professional's aggregate `verificationStatus` from all of them — every credential VERIFIED moves it to VERIFIED/TRUSTED/EXPERT by trust score, any single REJECTED sends it to NEEDS_INFO rather than failing the whole application. The bulk `POST /admin/verification/[id]` (approve/reject everything at once) still exists alongside it for straightforward applications. `AdminProfessionalQueue`'s detail dialog exposes both the bulk actions and per-credential controls; it also used to render a blank name for every professional (the API returns `user.profile.displayName`, not the flat `name` field the component read) — fixed along the way.

`ProfessionalApply`'s skill and service rows each carry an optional category dropdown, backed by `SERVICE_CATEGORIES` in `constants.ts` — not a database table. A case's category has always been an AI-classifier output (`ai-orchestrator.ts`), not something an admin curates, and `matching-engine.ts`'s keyword map already keyed its lists on the same ids (AC_REPAIR, PLUMBING, PASSPORT, …); `SERVICE_CATEGORIES` is that taxonomy made reusable, so a professional tags their work with an id the matching engine already understands instead of a free-typed string nothing reads. `admin/categories/route.ts`'s known-category list now derives from the same constant rather than keeping its own copy.

`findMatches()` now reads that `categoryId` as a real matching signal, not just metadata: an exact category match on a skill or service gets full skill-relevance credit and bypasses the keyword hard-filter, on top of (not instead of) the existing fuzzy keyword-in-skill-name matching — a professional/case pair that never sets `categoryId` scores exactly as before. This closes a real, previously-silent gap along the way: `CATEGORY_SKILL_MAP` only has a keyword list for the generic `GOVERNMENT_DOC` bucket, not for `PASSPORT`/`NIN`/`BIRTH_CERTIFICATE`/`DRIVERS_LICENSE` — cases classified into those specific categories got zero skill-relevance discrimination at all before this (everyone scored 0 on that axis), since there was neither a keyword list nor any other signal to score against.

Each submitted credential can carry an optional supporting document (an ID photo, a certificate scan) — up to 4MB, reusing the Vault's own `uploadDocument()` (`document-service.ts`) rather than a separate storage path, and linked via a `documentId` on `ProfessionalCredential`. Before this, `reviewCredential()`'s per-credential admin review had type/issuer/reference text to go on and nothing else — an admin was approving a claim, not inspecting proof. The document is owned by the applicant's own `userId`, so `getDocumentForViewer()`'s existing owner-or-admin rule already covers a reviewing admin — no new sharing/permission logic needed. `AdminProfessionalQueue`'s credential rows show a "view document" action when one's attached, opening it in a new tab as a blob URL (converted from the stored data URI — more reliable across browsers than navigating straight to a multi-MB `data:` URI).

### PWA (installable web app)

REZZO is web-only by design for now (see the account/verification sections above for why the API is already client-agnostic if that changes) — this makes the web app itself installable rather than building a native shell. `public/manifest.json` + `public/sw.js` + `public/offline.html` add "Add to Home Screen" support and app-shell caching. The icon set (`public/icons/`) is a real generated PNG set matching the app's actual navy-gradient "R" mark (`rezzo-gradient`), not the placeholder `logo.svg` favicon — built with Pillow since no SVG rasterizer was available in this sandbox otherwise.

The service worker is intentionally conservative given this is a live marketplace, not a content site: `/api/*` is **never** cached or served from cache — case status, payments, quotes, and messages always hit the network, because a stale response there would be actively wrong, not just a degraded experience. Same-origin static assets (Next's hashed `/_next/static/*` chunks, fonts, icons) are cached stale-while-revalidate as the browser actually requests them, since there's no build-time PWA plugin here to precache a fixed asset manifest against. Page navigations are network-first, falling back to a cached copy and then to `/offline.html`. Registration (`ServiceWorkerRegistration.tsx`) is production-only — it's skipped in `next dev` on purpose, since a service worker intercepting fetches fights HMR.

Not done: push notifications (needs a backend subscription store and a VAPID key pair, not attempted here) and background sync for actions taken while offline (the app doesn't queue any writes today, online or off — this would be new behavior, not just a service worker addition).

### Desktop layout

The decision: desktop-first isn't the same question as web-vs-native (see PWA above) — this is about how the layout itself uses a wide screen, and both surfaces need to work well. `ProfessionalApp`/`AdminApp` already had a proper responsive shell (a persistent sidebar on `md:` and up, bottom tabs below it) since the original transfer; `CustomerApp` — the surface the largest user group actually lives in — didn't. Every screen rendered inside a fixed `max-w-lg` (512px) column with a permanent mobile bottom-tab bar, on any screen size, desktop included. `CustomerApp` now matches the same sidebar/bottom-tabs pattern as the other two surfaces, and `CaseWorkspace` (the case detail view — quotes, payments, messages, disputes) got its column width widened responsively so it isn't squeezed into a phone-width strip on a wide monitor.

Not done: a full multi-column desktop redesign of `CaseWorkspace` itself (`ProfessionalCaseDetail` already has one — `grid lg:grid-cols-3` — but that file is ~200 lines; `CaseWorkspace` is ~1,600 lines across a dozen status-branched sections, and restructuring all of them into a verified-safe grid layout without a browser to check against wasn't attempted in this pass). It's wider on desktop now, but still single-column.

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
