# Sign-in Move Plan: Off Supabase

Dated 2026-11-24. Status: PROPOSAL. No code is written until the founder accepts section 2 and answers section 7.

## 0. Before writing code

`AGENTS.md` says this Next.js (16.3) differs from common knowledge. The developer reads these first, under `node_modules/next/dist/docs/01-app/`:

| Guide | Why |
| --- | --- |
| `01-getting-started/16-proxy.md` | `src/proxy.ts` replaces middleware; this plan edits it |
| `02-guides/authentication.md` | Session cookies and guards in this version |
| `02-guides/data-security.md`, `02-guides/server-actions.md` | Server actions are public endpoints; each needs its own guard |
| `02-guides/content-security-policy.md` | The CSP is built in `src/utils/supabase/middleware.ts` |
| `02-guides/forms.md`, `01-getting-started/07-mutating-data.md` | The sign-in forms |
| `02-guides/environment-variables.md` | The settings change |

## 1. Inventory: where Supabase is used, and for whom

Supabase does one job: sign-in. The database is reached through Prisma and `DATABASE_URL`, not through Supabase. No Supabase storage, tables or realtime calls exist in `src`.

| Purpose | Files | Needed now? |
| --- | --- | --- |
| **Admin** | `src/utils/admin/auth.ts` (`requireAdmin`, `assertAdminApi`; used by 26 files), `src/components/admin/AdminSidebar.tsx` (sign out) | **Yes.** The only sign-in the business needs today |
| **Sign-in pages and routes** | `src/components/auth/AuthForm.tsx`, `src/app/auth/login`, `auth/update-password`, `auth/verify-device`, `src/app/api/auth/{callback,confirm,device-check}` | Only as the admin's way in |
| **Session refresh and `/studio` gate** | `src/proxy.ts` → `src/utils/supabase/middleware.ts` (`updateSession`) | The CSP and security headers: yes. The Supabase refresh: no |
| **Creator Studio (paused)** | `src/app/studio/{layout,page}.tsx`, `src/app/actions/creator-studio.ts`, `src/lib/studio/loadStudioEntryContext.ts`, `src/app/actions/composition.ts`, `src/lib/services/personalization/sessionAuth.ts`, `src/lib/services/BackgroundUploadRouteService.ts` | No. The marketplace is paused |
| **Cart and checkout identity** | `src/app/actions/cart.ts` (`resolveAuthenticatedUserId`), `src/lib/services/CheckoutService.ts` (`resolveCallerIdentity`), `src/app/cart/page.tsx`, `src/app/checkout/checkoutLoader.ts`, `src/app/checkout/success/page.tsx` | No. Each already falls back to the signed guest cookie (`tb_anon_session`, `ANON_SESSION_SECRET`). Guest checkout works without sign-in |
| **Customer order history** | `src/app/orders/page.tsx`, `src/lib/services/DigitalDownloadService.ts` | No. Custom orders use a private link (see `CUSTOM_ORDER_PLAN.md`) |
| **Clients** | `src/utils/supabase/{client,server}.ts`, packages `@supabase/ssr`, `@supabase/supabase-js` | Removed at the end |

Who needs to sign in today: **one person, the founder.** Customers buy as guests and follow private links. Creators are paused.

## 2. Options

| | A. Neon Managed Better Auth for everyone | B. Admin-only sign-in in the repo | C. Keep Supabase |
| --- | --- | --- | --- |
| What it is | Neon's managed sign-in, enabled from the Vercel integration. Users live in the `neon_auth` schema of the Neon database | The founder signs in with a password and an emailed code. No customer or creator accounts | Add the Supabase settings to Vercel |
| Effort | Large. All 27 files, new SDK, sign-up, reset and device flows rebuilt, `User` rows linked to a second user table | Medium. `auth.ts` and the sign-in pages change; customer callers become "guest" through one helper | Small |
| New dependency | Yes (`@neondatabase/auth`; **unconfirmed** package name and API from search results, not verified in its docs) | None | None |
| Risk | Status, free-plan limits, email sending and proxy support are **unconfirmed**: the overview page states none of them. A managed service the app's only lock depends on | We own the lock. It must be reviewed like the Scyssor admin panel | The free project pauses after about a week idle; sign-in then fails for everyone ("Failed to fetch", seen 2026-11-24) |
| Removes Supabase | Yes | Yes | No |
| Path to customer accounts | Built in | Open: option A can be added later behind the same helper | Built in |

**Recommendation: B.** The business has one user who signs in. B removes Supabase with the least code that can go wrong, adds no service that could pause or change its terms, and leaves one seam (`getSessionUser()`) where customer accounts plug in later. A is the right move on the day customer accounts are wanted; building it now means rebuilding sign-up, reset and device checks for users who do not exist.

### What the repo's admin step does today, and why it is not enough alone

`src/app/admin-verify/actions.ts` (`verifyMasterPassword`) runs **after** a Supabase sign-in. It compares the typed text with `ADMIN_MASTER_PASSWORD` using a constant-time compare, limits tries (10 per address and 5 per admin in 15 minutes), and sets `tb_admin_stepup`, a cookie signed with `ADMIN_SESSION_SECRET` and bound to the admin's user id, valid 8 hours.

| Weakness if used as the only lock | Fix in this plan |
| --- | --- |
| One shared secret is the whole lock | Add a second step: a six-digit code emailed to `ADMIN_EMAIL` |
| The password sits in a setting as plain text | Store a scrypt hash (`ADMIN_PASSWORD_HASH`); a local command creates it |
| The try limit lives in memory unless Upstash is set, so each server instance counts alone | Count tries in the database (the existing `DeviceVerification.attempts` pattern, or a small new table) |
| Cookie is `SameSite=Lax` on path `/` | `__Host-` prefix, `SameSite=Strict`, `HttpOnly`, `Secure` |
| No sign-out on the server | Short life (8 hours) plus "end all sessions" by changing `ADMIN_SESSION_SECRET`. A session table is an optional extra (section 7) |

## 3. Design of option B

### 3.1 Sign-in

1. `/auth/login` becomes the admin sign-in: email and password. The create-account tab and "Forgot?" link are removed.
2. The server checks the email equals `ADMIN_EMAIL` and the password against `ADMIN_PASSWORD_HASH` (scrypt, constant-time). Wrong email, wrong password and "locked" all give the same answer.
3. A six-digit code (`crypto.randomInt`) is emailed through `src/lib/email.ts`. Only its hash is stored, with a ten-minute life, five tries, single use.
4. The code page sets the session cookie: `__Host-tb_admin`, HMAC-signed with `ADMIN_SESSION_SECRET`, holding the `User.id`, issue time and expiry (8 hours).
5. `/admin-verify` and `/auth/verify-device` are removed; the two steps above replace them.

Lockout: five failures per address and twenty overall in a sliding fifteen minutes, counted in the database, attempt written before it is checked (the race found in the Scyssor review).

### 3.2 What replaces each call

| Today | After |
| --- | --- |
| `resolveAdminUser` in `src/utils/admin/auth.ts` calls `supabase.auth.getUser()` | Reads and verifies `__Host-tb_admin`, loads the `User` by id, requires status `ACTIVE` and role `ADMIN`. `requireAdmin` and `assertAdminApi` keep their names and return type, so the 26 callers do not change |
| `AdminSidebar.tsx` `supabase.auth.signOut()` | A server action that clears the cookie |
| `resolveAuthenticatedUserId` (`cart.ts`), `resolveCallerIdentity` (`CheckoutService.ts`), `cart/page.tsx`, `checkoutLoader.ts`, `checkout/success/page.tsx`, `composition.ts`, `sessionAuth.ts`, `loadStudioEntryContext.ts`, `BackgroundUploadRouteService.ts`, `DigitalDownloadService.ts` | One new helper, `getSessionUser()` in `src/lib/auth/session.ts`, which returns `null` (guest) for now. Every caller already handles `null`. This is the seam for customer accounts later |
| `src/app/orders/page.tsx` | Shows "Use the link in your email to see your order" and a support link |
| `src/app/studio/*`, `actions/creator-studio.ts` | `/studio` and `/studio/*` join the existing pause redirects in `next.config.ts` (to `/custom`). The files stay |
| `src/app/api/auth/{callback,confirm,device-check}` | Removed |
| `src/utils/supabase/middleware.ts` `updateSession` | Renamed and moved to `src/lib/security/headers.ts`: keeps the nonce, CSP and security headers; drops the Supabase client and the `/studio` checks |
| `src/utils/supabase/{client,server}.ts`, both `@supabase/*` packages | Deleted last, after a search shows no importer |

### 3.3 `User` rows

No table is dropped. The admin is the existing `User` row whose email equals `ADMIN_EMAIL` and that has the `ADMIN` role. On a fresh Neon database that row does not exist, so a one-off script `scripts/create-admin.ts` creates the `ADMIN` role and the user (idempotent; run by the founder).

### 3.4 CSP and settings

| Change | Detail |
| --- | --- |
| CSP `connect-src` | Remove `https://*.supabase.co wss://*.supabase.co` |
| Remove | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_MASTER_PASSWORD`, `DEVICE_TRUST_SECRET` (after its last user is gone) |
| Add | `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` |
| `src/lib/env.ts` | Drop the two Supabase names from `REQUIRED_PRODUCTION_KEYS`; add `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `RESEND_API_KEY`. Preview keeps needing only the database and signing secrets; without `ADMIN_*` or Resend, admin sign-in answers "not configured" |
| `.env.example`, `scripts/launch-readiness.ts` | Updated to match |

### 3.5 Files

| New | Purpose |
| --- | --- |
| `src/lib/auth/password.ts` | scrypt hash and verify (pure) |
| `src/lib/auth/admin-session.ts` | Sign and verify the session cookie (pure) |
| `src/lib/auth/sign-in-code.ts` | Code creation, hashing, expiry, try cap (pure) |
| `src/lib/auth/lockout.ts` | Window arithmetic (pure) |
| `src/lib/auth/session.ts` | `getSessionUser()` seam |
| `src/app/auth/login/actions.ts`, `src/app/auth/login/code/page.tsx` | The two steps |
| `scripts/admin-hash-password.ts`, `scripts/create-admin.ts` | Founder commands |
| `prisma/migrations/0004_admin_sign_in` | `AdminLoginAttempt`, `AdminSignInCode` (two small tables; nothing dropped) |
| `tests/admin-sign-in.test.ts` | See 3.6 |

### 3.6 Tests

Wrong and right password; tampered hash; expired, reused and over-tried code; lockout per address and overall, including many attempts at once; forged, expired and wrong-user cookie; non-admin and inactive `User`; same outward answer for wrong and locked; a source test that no file under `src` imports `@supabase`; existing tests that pin Supabase names or the CSP are updated, not weakened.

### 3.7 Rollback

The work lands on its own branch. Until it is merged, restoring Supabase is: add the two Supabase settings in Vercel and redeploy the previous commit. After the Supabase files are deleted, rollback is a `git revert` of the merge. No data is destroyed by the move.

## 4. Threats and review checklist

| Threat | Control |
| --- | --- |
| Password guessing | scrypt, lockout in the database, same answer for every failure |
| Stolen password | Emailed code as second step |
| Code guessing or reuse | Hash stored, five tries, ten minutes, single use, bound to the password step |
| Counter races | Write the attempt, then count it, then check |
| Session theft or forgery | `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`, HMAC, 8-hour life |
| Cross-site requests | Server actions check origin; strict cookie |
| Someone keeps sign-in locked | Accepted: the store keeps selling; the founder waits out the window |
| Email outage | Sign-in is blocked; recovery is fixing Resend. Stated in the runbook |
| Unconfigured production | `env.ts` refuses to start without `ADMIN_*` and Resend |
| A guard missed in the swap | Source test: every file under `src/app/adm/admin/(panel)` and every admin action calls `requireAdmin` or `assertAdminApi` first |

Reviewer checklist: all 26 guard callers still guarded; no route reachable through the removed `/studio` checks; `getSessionUser()` cannot return a user by accident; no secret, code or cookie in logs; the CSP still passes its tests; `npm test` and `npm run build` on the founder's Mac.

## 5. Tasks

| ID | Task | Done when |
| --- | --- | --- |
| AM-01 | Pure modules and tests (password, session, code, lockout) | Tests pass |
| AM-02 | Migration `0004_admin_sign_in`; `create-admin` and `admin-hash-password` scripts | Schema test passes; founder ran neither against production yet |
| AM-03 | Sign-in pages and actions; `auth.ts` reads the new cookie; sign-out | Guard tests pass |
| AM-04 | `getSessionUser()` seam; swap the customer-side callers; `/orders` notice; `/studio` redirects | Existing cart and checkout tests pass |
| AM-05 | Headers module replaces `updateSession`; CSP and `env.ts` changes | CSP and env tests pass |
| AM-06 | Delete Supabase files and packages; update `.env.example` and readiness script | Source test: no `@supabase` import |
| AM-R | Independent security review | No open Blocker or High |

## 6. Founder steps

1. Set up Resend for thibut.com and add `RESEND_API_KEY` in Vercel.
2. Run the hash command locally; add `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` in Vercel.
3. Run the migration and `create-admin` once against the Neon database.
4. Sign in on a preview. Then remove the Supabase settings and close the Supabase project.

Not verifiable without a browser: cookies, redirects, the code email arriving, the CSP in a real page, and `next build`.

## 7. Decisions for the founder

| Decision | Recommendation |
| --- | --- |
| Option A, B or C | B |
| Second step: emailed code or an authenticator app | Emailed code (same as Scyssor; Resend is needed for customer emails anyway). An authenticator app needs no email service and is the fallback if Resend is delayed |
| Session table for true sign-out | Not now; 8-hour sessions and secret rotation are enough for one admin |

## Decisions after the proposal (2026-11-24)

| Decision | Detail | By |
| --- | --- | --- |
| Option | B: admin-only sign-in in the repository, Supabase removed. The founder was asked twice for a go-ahead and did not answer; work starts on this recommendation on its own branch and can be redirected | CTO (assumption, founder told) |
| Second step | An authenticator app (time-based codes, RFC 6238) instead of an emailed code, because no email key exists for this project yet and sign-in must not depend on one. Ten single-use recovery codes, stored hashed. Where this plan says "emailed code", read "authenticator code" | CTO (assumption, founder told) |

## As built (AM-01 to AM-06, 2026-11-24)

Reviewed: see "After the review" below. Nothing here has run in a browser or against a database.

### Where it differs from the proposal above

| Proposal | As built | Why |
| --- | --- | --- |
| `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` settings | No new setting. The admin's email, password hash (scrypt) and authenticator secret live in the database (`AdminCredential`), written by `scripts/create-admin.ts` | No password material in a setting; nothing new to paste into Vercel |
| Emailed code | Authenticator app (RFC 6238) and ten single-use recovery codes | Decision of 2026-11-24 |
| Stateless 8-hour cookie; session table "not now" | Signed cookie that names an `AdminSession` row. Sign out, and "Sign out everywhere", revoke rows | Founder directive: revocable sessions |
| Two tables | Five: `AdminCredential`, `AdminRecoveryCode`, `AdminSession`, `AdminSignInChallenge`, `AdminLoginAttempt` (migration `0004_admin_sign_in`, additive only) | Follows from the three rows above |
| `getSessionUser()` replaces the customer callers and they stop having a signed-in path | `getSessionUser()` returns "guest" (null), and every caller keeps its signed-in branch behind it | The existing cart, checkout and studio tests keep running unchanged against that branch; it is the seam for customer accounts later |
| `/orders` shows a "use the link in your email" notice | `/orders` unchanged for guests (it lists the orders of this browser's guest cookie); the "sign in to sync" link and the header account icon are removed | A guest still needs to see an order just placed |
| `DEVICE_TRUST_SECRET` removed | Kept, with `signDeviceTrustToken` / `verifyDeviceTrustToken` | The paused Studio files still reference it; it is one of the five secrets already set in Vercel. Remove with the Studio |
| `scripts/admin-hash-password.ts` | Not needed: `create-admin.ts` asks for the password and stores the hash itself | No hash to carry by hand |
| `RESEND_API_KEY` required in production | Not added | Sign-in no longer sends email |

Also done: every server page under `/adm/admin` now calls `requireAdmin()` itself (14 pages relied on the layout alone); the CSP and the stored-asset host allow-lists no longer name Supabase; `/studio` and `/studio/*` redirect to `/custom`; the two Supabase packages and the eight packages only they needed are removed from `package.json` and `package-lock.json`; CI no longer sets the Supabase settings.

### How sign-in works

1. `/adm/admin/login`: email and password. The try is written to `AdminLoginAttempt` first, then counted (five unsuccessful per address, twenty overall, sliding fifteen minutes), then checked. A refused try is removed again.
2. On success a five-minute `AdminSignInChallenge` row is created and a signed, `SameSite=Strict` pending cookie names it.
3. `/adm/admin/login/code`: a six-digit authenticator code (previous, current or next 30-second step; never one already used) or a recovery code. One conditional update takes a try (five per challenge) before the code is compared; another marks the step or recovery code used.
4. The session cookie (`__Host-tb_admin` on HTTPS, `tb_admin` on http://localhost) is a signed token naming an `AdminSession` row, eight hours. The guard reads the row and the user's status and role on every call.
5. Every failure, at either step, returns the same sentence. A code try without a valid pending cookie is refused before anything is counted.

Without `ADMIN_SESSION_SECRET` (32 characters or more) admin does not exist: the sign-in pages and every admin page answer 404.

### Founder set-up

`ADMIN_SESSION_SECRET` must have the same value on your computer and in Vercel: it protects the authenticator secret the command stores. If the value in Vercel cannot be read back, make a new one (`openssl rand -hex 32`), save it in Vercel for Production and Preview, and put the same line in your local settings file.

```
cd ~/thibut
npm install
node --env-file=.env.neon node_modules/prisma/build/index.js migrate deploy
node --env-file=.env.neon --import ./scripts/test-loader.mjs scripts/create-admin.ts
```

`.env.neon` must hold `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `ADMIN_SESSION_SECRET`. The last command shows the database host and asks you to confirm it, asks for your email and a password (not shown), then prints the authenticator setup key and ten recovery codes once.

Then sign in at `/adm/admin/login` (locally: `npm run dev`, then `http://localhost:3000/adm/admin/login`).

- Lost phone: sign in with a recovery code, then run the last command again with `--reset-authenticator`.
- Changing `ADMIN_SESSION_SECRET` signs everyone out and makes the stored authenticator secret unreadable: run `create-admin.ts` again afterwards.

### After the review (2026-11-25)

The independent review is `docs/AUTH_MOVE_REVIEW.md`: no Blocker, no High, three Medium, ten Low. What changed afterwards:

| Finding | What was done |
| --- | --- |
| AM-M1 sign-out did not remove the `__Host-` cookies | Cookies are now removed by setting them again, empty and expired, with the attributes they were set with (`Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`), through one helper. The cookie store's own delete is not used anywhere. If ending the session in the database fails, the cookie is still removed and the sign-in page says so |
| AM-M2 no way back in from a lockout | `scripts/create-admin.ts --clear-lockout` (below) |
| AM-M3 unlimited code guesses with a stolen password | A second, slower limit: after 10 wrong authenticator codes in 24 hours (a code is only asked for after a correct password), authenticator codes are refused until the oldest of the ten is 24 hours old. A recovery code, or `--clear-lockout`, still gets in. Refused tries are kept on record but count toward no limit. After signing in, the admin landing page shows "N failed code attempts since your last sign-in" and when a recovery code was used (AM-L5) |
| AM-L1 placeholder secret accepted | A signing secret that is still the placeholder from `.env.example` counts as not set: admin is a 404, the production start-up check fails, and `create-admin.ts` refuses |
| AM-L2 replacing the admin without the current password | `create-admin.ts` asks for the current password before replacing an existing admin. `--forgot-password` skips that after you type a confirmation phrase |
| AM-L3 cookie name and `Secure` follow `NODE_ENV` | Left as it is. `npm run start` on `http://localhost` therefore sets `__Host-`/`Secure` cookies, which Safari refuses there; use `npm run dev` locally, where plain cookie names are used |
| AM-L4 sign-in tables never pruned | On each successful sign-in, three single `DELETE` statements remove tries and challenges created, and sessions expired, more than 30 days ago |
| AM-L6 order summary shown for an order number alone | `/checkout/success` shows an order only with proof of ownership (the guest cookie that placed it, or the Stripe checkout session id); otherwise a plain "Thank you" with no order details |
| AM-L8 | The six call sites are formatted normally again |
| AM-L9 | Admin API routes answer 404, like the pages, when sign-in is not configured. The trimmed secret is used everywhere (length checks, token signing, key derivation) |
| AM-L7, AM-L10 | Open |

`AdminLoginAttempt` gained one column, `refused`. Migration `0004_admin_sign_in` was edited in place: it had not been applied to any database.

**The admin address.** By founder decision the admin area is at `/adm/admin`, and sign-in is at `/adm/admin/login`. Where the proposal above says `/auth/login`, read `/adm/admin/login`. `/admin`, `/admin/...` and `/auth/login` are ordinary 404 pages with no redirect. The address is written once in code (`src/lib/admin-path.ts`), in the folder names under `src/app/adm/admin`, and in three lines of `next.config.ts`; a test keeps them in step. It is not listed in `robots.txt` (that file is public); admin pages are marked noindex. The guarded admin API stayed at `/api/admin/...`. The address is not a protection: the password, the authenticator code and the lockout are.

**Commands** (each shows the database host and asks you to confirm it; none takes a password on the command line; all refuse to run on Vercel):

```
node --env-file=.env.neon --import ./scripts/test-loader.mjs scripts/create-admin.ts
node --env-file=.env.neon --import ./scripts/test-loader.mjs scripts/create-admin.ts --reset-authenticator
node --env-file=.env.neon --import ./scripts/test-loader.mjs scripts/create-admin.ts --clear-lockout
node --env-file=.env.neon --import ./scripts/test-loader.mjs scripts/create-admin.ts --forgot-password
```

- No option: create the admin. If one exists, it asks for the current password, then replaces the password, authenticator and recovery codes and signs every session out.
- `--reset-authenticator`: new authenticator key and recovery codes; the password is unchanged.
- `--clear-lockout`: asks for the current password, then deletes the unsuccessful sign-in tries and nothing else. Use it when sign-in keeps failing with the right details (someone is holding the page locked, or ten wrong codes were entered in a day).
- `--forgot-password`: replaces everything without the current password, after you type the phrase it shows.

**Accepted and still open.** Anyone can keep the sign-in page locked by failing twenty times every fifteen minutes; `--clear-lockout` lets the founder back in but does not stop a determined repeat. No email is sent on a lockout or a sign-in (no email key exists for this project yet). An unauthenticated call to an admin server action is redirected to the sign-in address, which reveals it; the address is not a secret.

### Files moved aside, not deleted

Deleting was not permitted in the session that did this work. The old Supabase files were moved to `_to_delete/` at the repository root, each renamed with `.removed`, and that folder is ignored through `.git/info/exclude` (not `.gitignore`). Git sees the originals as deleted. Delete the folder by hand: `rm -rf _to_delete`.

### Not verified

`next build`; cookies, redirects and the two forms in a browser; the Prisma queries and the migration against Postgres (the store is typed by hand and pinned against the schema by a test); `scripts/create-admin.ts` beyond its refusals (its hidden prompt and its database writes); an authenticator app accepting the setup key (the codes match the RFC 6238 test vectors).
