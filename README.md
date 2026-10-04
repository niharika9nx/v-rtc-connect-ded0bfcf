# V-RTC Connect

A bus management system for college transportation (VES – APSRTC). It handles student/faculty
profiles, bus allocation, bus pass upload + AI-assisted OCR verification, fee tracking, and alerts.

## Tech stack

- **Vite** + **React 18** + **TypeScript** (strict mode)
- **shadcn/ui** + **Tailwind CSS**
- **React Router 7** for routing
- **TanStack Query** for async state
- **Supabase** for auth, Postgres, storage, and edge functions
- **Vitest** for unit tests

## Getting started

Requirements: Node.js 20.19+ (or 22.12+) and npm.

```sh
npm install
cp .env.example .env   # then fill in the Supabase values
npm run dev            # http://localhost:8080
```

### Environment variables (front-end)

Set these in `.env` (see `.env.example`). The publishable/anon key is safe to expose — Row Level
Security protects the data. Never commit `.env` or the service-role key.

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref |

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server (port 8080) |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |

## Project structure

```
src/
  components/        UI components (shadcn primitives under components/ui)
  hooks/             Auth, notifications, session-timeout hooks
  integrations/      Supabase client + generated DB types
  lib/               Utilities, college config, shared DB type aliases
  pages/             Route-level screens (student, faculty, admin)
supabase/
  functions/         Deno edge functions (+ _shared helpers)
  migrations/        SQL migrations
tests/               Vitest tests for edge-function helpers
```

## Edge functions

Deployed to Supabase (see `supabase/config.toml`). All browser-facing functions enforce an
`ALLOWED_ORIGIN` CORS allowlist and validate input.

| Function | Purpose |
| --- | --- |
| `check-expiring-passes` | Scheduled job; creates pass-expiry / renewal alerts. Auth via service-role token. |
| `enhance-pass` | AI (Gemini) OCR of uploaded bus passes; per-user hourly rate limit (fail-closed). |
| `get-signed-url` | Issues short-lived signed URLs for pass documents (owner or admin only). |
| `respond-to-alert` | Records a user's response to an alert. |
| `delete-user` | Admin-only user deletion (blocks deleting other admins). |
| `create-test-alert` | Admin test utility, disabled unless `ENABLE_TEST_ALERTS=true`. |

### Edge function secrets

Configured in the Supabase project (not in this repo):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY` — used by `enhance-pass`
- `ALLOWED_ORIGIN` — comma-separated list of allowed browser origins (e.g. the production URL)
- `ENABLE_TEST_ALERTS` — set to `true` to enable `create-test-alert`

Local development origins (`http://localhost:8080`, `http://127.0.0.1:8080`, and `:5173`) are
allowed automatically.

### Deploying

```sh
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy
```

## Testing

Unit tests live in `tests/` and cover the shared edge-function helpers (`auth`, `cors`,
`validation`, `errors`).

```sh
npm test
```

## CI

`.github/workflows/ci.yml` runs on push/PR: install, lint, typecheck (`tsc --noEmit`), and tests.

## Deployment

The front-end is deployed on Vercel (`vercel.json` provides SPA routing). Pushing to `main`
triggers a deployment.
