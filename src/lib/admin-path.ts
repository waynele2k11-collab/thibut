/**
 * Where the admin area lives. This is the ONE place the address is written in code: every
 * link, redirect, revalidation and test builds on it. Safe to import from server and client.
 *
 * Changing the address takes three edits that tests keep in step (tests/admin-sign-in-wiring):
 *   1. `ADMIN_BASE_PATH` below;
 *   2. the folder `src/app/adm/admin` (Next.js takes the address from the folder names);
 *   3. the two keepsake-editor keys and the X-Robots-Tag source in `next.config.ts`.
 *
 * The address is not a secret and is not a protection: it only keeps the automated traffic
 * that probes `/admin` on every website away from the sign-in page. Access is decided by
 * `requireAdmin` / `assertAdminApi` (src/utils/admin/auth.ts). Do not list it in robots.txt,
 * which is public; admin pages are marked noindex instead.
 */
export const ADMIN_BASE_PATH = "/adm/admin";

/** `adminPath("/orders")` → "/adm/admin/orders"; `adminPath()` → "/adm/admin". */
export function adminPath(subPath = ""): string {
  if (subPath === "" || subPath === "/") return ADMIN_BASE_PATH;
  return `${ADMIN_BASE_PATH}${subPath.startsWith("/") ? "" : "/"}${subPath}`;
}

export const ADMIN_SIGN_IN_PATH = adminPath("/login");
export const ADMIN_SIGN_IN_CODE_PATH = adminPath("/login/code");

/** True for the admin area itself and anything under it. */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_BASE_PATH || pathname.startsWith(`${ADMIN_BASE_PATH}/`);
}
