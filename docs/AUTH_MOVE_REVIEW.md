# Sign-in Move: Independent Security Review (AM-R)

Dated 2026-11-24. Branch `feat/admin-sign-in`, base `18f8ac3`. Reviewer had read-only access; this file is the only thing written.

**Verdict: no Blocker, no High. Three Medium, ten Low.** No way was found to reach admin data without a live admin session, or another guest's cart, order list or download without that guest's signed cookie or link. AM-M1 should be fixed before merge: it is small and it makes "sign out" untrue in the browser.

## 1. Scope

All uncommitted changes and untracked files: 69 tracked files changed (548 insertions, 1,819 deletions) plus `src/lib/auth/*`, `src/lib/security/headers.ts`, `src/app/auth/login/{actions.ts,code/}`, `src/components/auth/Admin*Form.tsx`, `scripts/create-admin.ts`, `prisma/migrations/0004_admin_sign_in`, `tests/admin-sign-in*.test.ts`, `tests/helpers/*`. Read first: `AGENTS.md`, `docs/AUTH_MOVE_PLAN.md` (including "Decisions after the proposal" and "As built"), and the Next.js 16.3 cookie docs and compiled cookie code under `node_modules/next/dist`.

`_to_delete/` was not reviewed. Nothing in `src`, `tests`, `scripts`, `prisma`, `.github`, `package.json`, `next.config.ts`, `tsconfig.json` refers to it.

## 2. What was run

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` (temp config in `/tmp`, `.next`, `scripts`, `_to_delete` excluded) | Exit 0, no errors |
| `tests/admin-sign-in.test.ts` + `tests/admin-sign-in-wiring.test.ts` | 26 of 26 pass |
| Full suite (`tests/**/*.test.ts`) | 148 tests: 130 pass, 18 fail. Every one of the 18 was read: 8 tests and 6 files stop on `Cannot find module '@resvg/resvg-js-linux-x64-gnu'`, 5 files on `sharp.libvipsVersion is not a function`, 1 file on Prisma "could not locate the Query Engine" (`keepsake-admin-input`, its 5 tests pass). No assertion failure anywhere |
| `eslint --no-cache` on every changed or new `.ts`/`.tsx` | No output, clean |
| Own script against `totp.ts`, `secret-box.ts`, `password.ts` | All six RFC 6238 SHA-1 vectors (8 digits) and the ten RFC 4226 HOTP values match; drift accepts steps -1, 0, +1 and refuses -2, +2; base32 round-trips 200 random buffers, accepts padding, spaces, lower case, refuses `1`; two seals of one secret differ (fresh IV); wrong key, wrong purpose key, flipped body byte, 4-byte tag all return null; malformed, truncated, extra-field, N=2^30 hashes never verify; empty and 300-character passwords never verify |
| Next's `ResponseCookies.delete("__Host-tb_admin")` | Emits `__Host-tb_admin=; Path=/; Expires=Thu, 01 Jan 1970…` with no `Secure` (see AM-M1) |

Not run, by instruction: database, migrations, dev server, `next build`, `npm install`, network.

**Limit of the test evidence.** Five of the six edited suites (`security-auth`, `checkout-cart-studio`, `calligraphy-ai-inngest`, `print-master-fonts`, `runtime-csp-ratelimit`) and two of three tests in `qa-audit-verification` cannot load in this Linux sandbox (sharp/resvg binaries). Their edits were reviewed by reading the diff only. They must be run on the founder's Mac.

## 3. Findings

### Blocker

None.

### High

None.

### Medium

**AM-M1. Sign-out and the pending-cookie clean-up do not remove the `__Host-` cookies in the browser.**
`src/app/auth/login/actions.ts:154, 165, 166`.
`cookieStore.delete(name)` sends `name=; Path=/; Expires=1970` without `Secure` (confirmed by running Next's own cookie code). Browsers ignore any `Set-Cookie` for a `__Host-` name that lacks `Secure`, deletions included. On the live site the cookie therefore stays in the browser after "Log Out".
Scenario A (normal): the database row is revoked, so the stale cookie is dead. Harmless, but the comment "the cookie goes first" is false.
Scenario B (database unreachable during sign-out): the row is not revoked and the cookie is not removed, yet the page says "You are signed out on this browser" (`src/app/auth/login/page.tsx:17-18`). The session stays fully valid for up to eight hours on that computer.
The tests cannot see this: their cookie store is a map, not a browser.
Fix: replace each `delete(name)` with `cookieStore.set(name, "", { ...adminSessionCookieOptions(), maxAge: 0 })` (pending options for the pending cookie), and assert the `Secure` attribute on the clearing header in a test. Reword the notice until then. Not verified in a browser.

**AM-M2. Anyone can keep the founder locked out, with no way back in short of editing the database.**
`src/lib/auth/lockout.ts:11`, `src/lib/auth/admin-sign-in.ts:102-119`.
Twenty unsuccessful tries from all addresses in fifteen minutes refuse every further try, including the founder's correct one. An attacker with four addresses needs about 80 wrong-password posts an hour, no credentials, to hold the lock indefinitely. Admin holds order fulfilment. The plan accepts this ("the founder waits out the window"), but an attacker who keeps going never lets the window end.
Fix (any one): add `--clear-lockout` to `scripts/create-admin.ts` (deletes `AdminLoginAttempt` rows after the database-host confirmation) and document it; or let the overall cap slow tries down instead of refusing them; or put `/auth/login` behind Vercel's firewall rate limit. Record the choice in the runbook.

**AM-M3. With a stolen password, the authenticator step allows about 1,920 code guesses a day and nobody is told.**
Same lines as AM-M2; `SIGN_IN_CHALLENGE_MAX_TRIES` in `admin-sign-in.ts:20`.
Correct-password tries are marked succeeded and never count, so an attacker who knows the password can open challenges without limit; only the overall cap (20 per 15 minutes) bounds code guesses. Three of 1,000,000 codes are valid at any moment: roughly 0.6% a day, about even odds after four months of quiet trying. The founder would only notice that sign-in fails.
Fix: count failed CODE tries per admin over a longer window (for example 10 in 24 hours, then require a recovery code or the local command), and send an email on every lockout and every successful sign-in.

### Low

**AM-L1. The placeholder in `.env.example` passes the "configured" check.** `.env.example:18` is 53 characters; `isAdminSignInConfigured` and `env.ts` only test length. A deployment that copies the file unchanged seals the authenticator secret with a public key. Session tokens still need an unguessable row id, so this is not a direct bypass. Fix: refuse values starting `replace-with` in `isAdminSignInConfigured`, `env.ts` and `create-admin.ts`.

**AM-L2. Replacing the whole admin (password included) does not ask for the current password.** `scripts/create-admin.ts:266-280`. Only `--reset-authenticator` checks it (`admin-enrolment.ts:140-142`, confirmed). Whoever can run the script already holds the database address and the master secret, so nothing is gained; note it so the reset path is not mistaken for a control.

**AM-L3. Cookie name and `Secure` follow `NODE_ENV`, not the scheme.** `src/lib/auth/admin-cookies.ts:22`. `next start` on `http://localhost` sets `__Host-`/`Secure` cookies; Safari refuses them there. Development (`next dev`) is unaffected.

**AM-L4. Sign-in tables are never pruned.** `AdminLoginAttempt`, `AdminSignInChallenge`, `AdminSession` only grow (up to about 1,900 attempt rows a day under AM-M2). Add a delete of rows older than a day to an existing scheduled job.

**AM-L5. A used recovery code is not reported.** `completeAdminSignIn` returns `usedRecoveryCode` (`admin-sign-in.ts:211`); the action drops it. The founder is never told a code was spent or how many remain. Also, a recovery code and an authenticator code sent at the same instant on one challenge both pass their own check and only one opens a session: the recovery code is spent for nothing. Harmless.

**AM-L6. Existing, not changed by this work: `/checkout/success?order=<number>` shows the order number, item titles, quantities and total to anyone who has the number.** `src/app/checkout/success/page.tsx:54-70, 235-290`. Downloads on that page are ownership-gated (`:187-191`). Order numbers carry a millisecond timestamp and 32 random bits, so guessing is impractical. Listed because the brief asked about guests reading another guest's order.

**AM-L7. Existing: `package.json` and the lock file disagree at the root.** `package.json:45` lists `sharp ^0.34.3`; the lock's root lists `canvas` and `html-to-image` instead and pins sharp 0.35.3. True at `18f8ac3` too. The Supabase removal itself is consistent: ten lock entries removed (eight `@supabase/*`, `cookie`, `iceberg-js`), none added or altered, no orphans, no remaining dependant. `npm ci` was not run; expect `npm install` to rewrite the lock. `node_modules/@supabase` is still on disk until then.

**AM-L8. Six swapped call sites were collapsed onto one line.** `cart.ts:87`, `composition.ts:68`, `cart/page.tsx:100`, `checkoutLoader.ts:102`, `checkout/success/page.tsx:48`, `loadStudioEntryContext.ts:139` (`…getSessionUser();    if (…) {      …`). Correct, but hard to review. Run the formatter.

**AM-L9. Small inconsistencies.** (a) Admin API routes answer 401, not 404, when sign-in is not configured (`assertAdminApi`); pages answer 404 as documented. (b) `tokens.ts` `requireSecret` accepts 16 characters while everything else needs 32; every caller checks 32 first. (c) Length checks trim `ADMIN_SESSION_SECRET` but the keys use the raw value: a trailing space in one place and not the other makes the authenticator secret unreadable. (d) `src/lib/env.ts:100-101` comment still mentions a "sign-in provider". (e) `.claude/settings.local.json` is untracked and not ignored: do not commit it.

**AM-L10. The paused Studio's API routes and composition actions are still reachable by guests.** `/api/personalization/*`, `/api/backgrounds/generate`, `/api/uploads/background`, `ensureStudioSessionAction`, `saveCompositionToSession`. Unchanged behaviour: they were guest-reachable before, are rate-limited, and check ownership by the signed guest cookie. Only the pages are redirected.

## 4. What held up (items 1 to 13)

1. **Password.** scrypt N=2^17, r=8, p=1, 16-byte salt, 32-byte key, `timingSafeEqual`; parameters below N=2^14 or above 256 MB refused; a missing or malformed hash still costs one full scrypt. No plain-text password in any setting, table or log. `ADMIN_MASTER_PASSWORD` appears only in three tests that assert its absence.
2. **TOTP.** Matches the RFCs (section 2). Replay: `acceptTotpStep` is one `updateMany … WHERE totpLastStep IS NULL OR totpLastStep < step`. Secret sealed with AES-256-GCM, random 12-byte IV, tag checked, HKDF-SHA256 key per purpose. Rotating `ADMIN_SESSION_SECRET` makes codes and recovery codes fail closed; `--reset-authenticator` (password only) restores them. Recovery codes: ten, about 49 bits, HMAC-SHA256 with a derived key, single use by one conditional `updateMany`.
3. **Flow binding.** The code action refuses before counting without a valid pending token. The token is HS256, five minutes, `purpose: admin_pending`, carries user and challenge ids; a session token is not accepted as pending or the reverse. After success the challenge is consumed and the token is useless. Try cap, consume, step and recovery updates are each a single conditional SQL statement in `admin-store.ts`. Lockout is write, count, decide; I checked the argument that no more than the cap can pass under concurrency: the last admitted try always sees every earlier admitted one.
4. **Session.** `__Host-tb_admin`, HttpOnly, Secure, SameSite=Strict, Path=/, eight hours; plain `tb_admin` in development. Token names a database row; row, owner, expiry, revocation, user status and role are read on every guard call. Session id is created after both steps, so no fixation. Sign-out revokes the row; "everywhere" revokes all and requires a live session. Exception: AM-M1.
5. **Authorization.** Table in section 5. Nothing unprotected.
6. **Guests.** Section 6.
7. **Proxy and headers.** `headers.ts` is the old function minus the Supabase client and the `/studio` checks. CSP keeps the per-request nonce and `strict-dynamic`; no Supabase host remains in CSP, `DigitalDownloadService` or `print-generator` allow-lists. HSTS and the `next.config.ts` headers are unchanged. Matcher unchanged. The proxy sets no cookies.
8. **`create-admin.ts`.** Rejects every argument except `--reset-authenticator`; needs a terminal; password read in raw mode, never echoed; refuses when `VERCEL` is set; prints host and database name only and requires `yes`; errors print the class and Prisma code only. Prints, once: email, setup key, `otpauth://` address, ten recovery codes. Runtime behaviour not verified (needs a terminal and a database). The generated Prisma client in this sandbox predates the new models, and `scripts/` is outside `tsconfig.json`, so this file has not been type-checked by anyone here.
9. **Migration.** Five `CREATE TABLE`, five indexes, four foreign keys to `"User"("id")` (TEXT in `0000_baseline`). No existing table touched. Column names, types, defaults and nullability match `schema.prisma` and every field the hand-typed store and the script use.
10. **Env.** `ADMIN_SESSION_SECRET` (32+) is required in production and in preview. A preview that shares the production database and secret is a second working sign-in page on a `vercel.app` address, sharing the lockout table; it grants nothing without the password and code. Keep Vercel deployment protection on for previews.
11. **Dependencies.** See AM-L7. No `supabase` string anywhere in `src`.
12. **Tests.** Removed assertions (19 in `security-auth`) all belong to deleted code (OAuth callback, master password, device PIN); added ones cover redirect safety, removed routes, a suspended admin, and the CSP without Supabase. No remaining assertion was loosened. `auth-seam-stub.ts` replaces `getAdminIdentity` whole and makes `getSessionUser` return a signed-in user, a state production cannot reach; it cannot hide a guard failure because the real identity module, actions, pages and guard run in `admin-sign-in-wiring.test.ts` against a fake Prisma. Untested: the conditional updates on real Postgres; browser cookie behaviour (AM-M1); `create-admin.ts` prompts and writes; the redirect of `/studio`; a secret rotation.
13. **Logging.** One log line in the sign-in path: fixed text and the error class name. No email, password, code, token or address.

## 5. Authorization table

"Layout only before" = at `18f8ac3` the file had no guard of its own.

| File | Kind | Guard (line) before first data access | Before |
| --- | --- | --- | --- |
| `admin/layout.tsx` | layout | `requireAdmin` :17 | same |
| `admin/page.tsx` | page | :10 | layout only |
| `admin/art/page.tsx` | page | :10 | layout only |
| `admin/art/[id]/page.tsx` | page | :15 | layout only |
| `admin/background-presets/page.tsx` | page | :11 | layout only |
| `admin/background-presets/[id]/page.tsx` | page | :15 | layout only |
| `admin/background-presets/new/page.tsx` | page, static, no data | none needed (layout; form posts to guarded `createPreset`) | same |
| `admin/gallery/page.tsx` | page | :13 | guarded |
| `admin/gallery/new/page.tsx` | page | :10 | layout only |
| `admin/gallery/[id]/page.tsx` | page | :13 | layout only |
| `admin/knowledge/page.tsx` | page | :9 | layout only |
| `admin/products/page.tsx` | page | :14 | layout only |
| `admin/sellers/page.tsx` | page | :10 | layout only |
| `admin/sellers/[id]/page.tsx` | page | :17 | layout only |
| `admin/studio/page.tsx` | page | :7 | layout only |
| `admin/users/page.tsx` | page | :10 | layout only |
| `admin/users/[id]/page.tsx` | page | :16 | layout only |
| `admin/catalog/page.tsx`, `catalog/categories`, `catalog/designs` | pages | :30, :21, :175 | guarded |
| `admin/finance/page.tsx`, `admin/orders/page.tsx`, `admin/keepsake-editor/page.tsx` | pages | :26, :18, :14 | guarded |
| `admin/ai/calligraphy/page.tsx`, `admin/fonts/page.tsx` | client pages, no data | data only through `/api/admin/*` below | same |
| `admin/loading.tsx`, `CatalogTabs`, `PresetForm`, `PresetRow`, `ProductsGrid`, gallery forms | components | no data | same |
| `admin/keepsake-editor/fonts/[id]/route.ts` | GET | `assertAdminApi` :21 | same |
| `admin/background-presets/actions.ts` | 4 actions | `requireAdmin` first line of each | same |
| `api/admin/fonts/route.ts` | GET, DELETE | :17, :45 | same |
| `api/admin/fonts/toggle`, `fonts/download` | POST | :19, :14 | same |
| `api/admin/gallery/create` | POST | :39 | same |
| `api/admin/gallery/[id]` | DELETE, PATCH | :44, :86 | same |
| `api/admin/calligraphy/benchmark` | POST | :10 | same |
| `api/print-master/route.ts` | POST | `assertAdminApi` passed to the service | same |
| `actions/fonts.ts`, `indexnow.ts` | 1 action each | first line | same |
| `actions/keepsake-admin.ts` | 6 actions | first line of each | same |
| `actions/printful-admin.ts` | 4 actions | first line of each | same |
| `actions/gallery.ts` `createGalleryItem` | action | :49 | same |
| `actions/gallery.ts` `getGalleryItemById` | action, public by design | admin sees drafts; everyone else `published: true` only; a guard error means "not admin" | same |

The developer's statement is correct: exactly 14 pages gained their own `requireAdmin()`, and each had none before. Not configured: every page and action using `requireAdmin` answers 404; `/auth/login` and `/auth/login/code` answer 404; admin API routes answer 401 (AM-L9a).

## 6. Former `supabase.auth` call sites

| Call site at `18f8ac3` | Now | Effect |
| --- | --- | --- |
| `utils/admin/auth.ts` `getUser` | `getAdminIdentity()` (cookie + database row), user loaded by id | Stronger. No fall-through |
| `utils/supabase/middleware.ts` `getUser` (`/studio` gate) | Removed; `/studio` redirected in `next.config.ts`; layout redirects when there is no user | Closed |
| `components/admin/AdminSidebar.tsx` `signOut` | `signOutAction`, `signOutEverywhereAction` | See AM-M1 |
| `actions/cart.ts`, `cart/page.tsx`, `checkout/checkoutLoader.ts`, `services/CheckoutService.ts` | `getSessionUser()` → null → signed guest cookie | Ownership by `anonymousSessionId === anonId`; every branch requires a non-null `anonId`. Fails closed |
| `checkout/success/page.tsx` | same | Downloads need the guest cookie or the Stripe session id. See AM-L6 for the summary |
| `orders/page.tsx` | same | Lists only `{ anonymousSessionId: anonId, buyerId: null }`; no cookie, no query. Orders that carry a `buyerId` from the Supabase period are no longer shown to anyone but admin |
| `actions/composition.ts`, `studio/loadStudioEntryContext.ts`, `services/personalization/sessionAuth.ts`, `services/BackgroundUploadRouteService.ts` | same | Guest cookie ownership, or `assertAdminApi` for the asset route. Fails closed |
| `actions/creator-studio.ts` (4 actions) | `getSessionUser()` → null | Always "Authentication required". Unreachable, fails closed |
| `studio/layout.tsx`, `studio/page.tsx` | `getSessionUser()` → null | Layout redirects to `/custom`; the page loads nothing when user is null |
| `api/auth/{callback,confirm,device-check}`, `auth/verify-device`, `auth/update-password`, `admin-verify`, `components/auth/AuthForm.tsx` | Deleted | Gone; a test asserts the files do not exist |

`getSessionUser()` is `return null` and nothing else. No place that used the signed-in user id for an ownership check now passes without it: in each, the user branch simply never matches and the guest-cookie branch decides.

## 7. Statement on reachability

- **Admin data.** I found no page, layout, action or route that reads or writes admin data before `requireAdmin` or `assertAdminApi` has checked a signed cookie, its live database session row, and an ACTIVE user with the ADMIN role.
- **Another guest's data.** I found no path to another guest's cart, checkout session, order list, uploaded background or digital download without that guest's signed `tb_anon_session` cookie, a signed download token, or their Stripe checkout session id. The one exception is existing and unchanged: the order summary in AM-L6, which needs the order number.

## 8. Not verified

`next build`; any browser behaviour (cookies, redirects, forms, the `__Host-` deletion in AM-M1 was confirmed from the header Next emits and the cookie-prefix rule, not in a browser); the migration and the Prisma queries on Postgres; `scripts/create-admin.ts` at run time and its type-check; the five edited suites listed in section 2; `npm ci`; whether a settings file made by `vercel env pull` contains `VERCEL=1` (the script would then refuse to run).

## 9. Hand tests for the founder

1. `npm install`, then `npm test` on the Mac: expect zero failures, including the five suites that could not run here.
2. Run `create-admin.ts`; confirm the host shown is the Neon host; add the setup key to the authenticator app.
3. Sign in with email, password and a fresh code. In the browser's developer tools confirm the cookie is `__Host-tb_admin`, HttpOnly, Secure, SameSite Strict.
4. Wrong code once: same sentence as a wrong password. Then the right code: signed in.
5. Replay: sign out, sign in again and enter the same six digits within 30 seconds: must fail. Wait for the next code: must work.
6. Lockout: six wrong passwords in a row, then the right one: must fail for fifteen minutes.
7. Sign out, then look at the cookies: `__Host-tb_admin` is expected to still be there until AM-M1 is fixed; `/admin` must still redirect to sign-in. After the fix the cookie must be gone.
8. Sign in on two browsers; "Sign out everywhere" on one; reload `/admin` on the other: sign-in page.
9. Recovery code: sign in with one in place of the six digits; try the same code again: must fail.
10. Open `/studio`, `/admin-verify`, `/api/auth/callback`: redirect to `/custom`, 404, 404.
11. In a private window open `/orders` and `/cart`: empty, no error.

## Resolution (2026-11-25)

| Finding | Action |
| --- | --- |
| AM-M1 | Fixed. Cookies are removed by setting them again, expired, with their original attributes; a test checks the emitted header |
| AM-M2 | Fixed. `create-admin.ts --clear-lockout` (run by the founder, asks the password). `--forgot-password` was also added |
| AM-M3 | Fixed. Ten wrong authenticator codes after a correct password within 24 hours pause code entry; recovery codes still work. The admin landing page shows failed code tries and recovery-code use |
| AM-L1, L2, L4, L5, L6, L8, L9 | Fixed |
| AM-L3 | Open, documented |
| AM-L7, L10 | Open |

Also in this change: the admin area moved to `/adm/admin` (founder decision). `/admin` and `/auth/login` have no route. The six `/api/admin/*` routes stayed and are guarded. Known leak: an unauthenticated call to an admin server action redirects to the sign-in address.

After the fixes: type check and lint clean; sign-in tests 36 pass; full suite 140 pass, 18 fail on missing Linux binaries only. Not verified: `next build`, a browser, Postgres, `create-admin.ts` at run time, and the suites that need Mac binaries. The fixes and the move have not had a second independent review.
