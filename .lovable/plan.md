# Rotate the Supabase anon key

Since `.env` was previously pushed to GitHub, the anon key that was committed is exposed in git history forever. Rewriting history is disruptive (force-push, everyone re-clones), so the practical fix is to rotate the key — the old value in history becomes useless.

## Important context

Your `.env` only contained the Supabase URL + **publishable (anon) key**. This key is *designed* to be public and ships in every browser bundle — RLS is what actually protects your data. So this rotation is defense-in-depth, not an emergency.

The `service_role` key was never in `.env` (it lives only in Supabase Edge Function secrets), so nothing sensitive was ever exposed.

## Steps (you do these in Supabase — I can't rotate keys from here)

1. Open **Supabase Dashboard → Project Settings → API Keys**:
   https://supabase.com/dashboard/project/riqqyhaguckeijcownor/settings/api-keys
2. Find the **anon / publishable key** and click **Rotate** (or "Roll key").
3. Copy the new anon key.
4. Back in Lovable, Supabase auto-syncs the new key into `.env` as `VITE_SUPABASE_PUBLISHABLE_KEY` on the next build. If it doesn't, disconnect and reconnect the Supabase integration from the Lovable **+ menu → Supabase** to force a resync.
5. Verify the app still loads after the rotation (login should work — if it fails, the `.env` didn't refresh; reconnect Supabase).

## What I will do in the codebase

Nothing — no code changes are needed. The client reads the key from `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`, so once `.env` updates, the app picks up the new key automatically on the next build.

## Also worth checking (optional)

- **`service_role` key**: never rotate casually — if you do, all edge function secrets referencing it must be updated too. Only rotate if you have reason to believe it leaked (it wasn't in `.env`, so almost certainly fine).
- **GitHub repo visibility**: if the repo is public, consider making it private in GitHub settings as extra hygiene, even though the exposed key was public-safe.
