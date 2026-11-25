/**
 * Test stand-in for the two sign-in seams:
 *   - `@/lib/auth/session`         (the customer of the request; "guest" in the real module)
 *   - `@/lib/auth/admin-identity`  (the admin session cookie and its database row)
 *
 * Each suite already has a harness that says who is signed in (its `createSupabaseClient()`
 * hook, named from when sign-in was done by Supabase). This stub feeds that same answer to
 * both seams, so every suite keeps exercising its signed-in, guest, non-admin and admin paths
 * exactly as before. Whether that user is an ACTIVE admin is still decided by the real guard
 * in src/utils/admin/auth.ts, from the suite's mock database.
 *
 * The real modules are tested on their own in tests/admin-sign-in.test.ts.
 */
export function isAuthSeamSpecifier(specifier: string): boolean {
  return (
    specifier === "@/lib/auth/session" ||
    specifier.endsWith("/lib/auth/session") ||
    specifier === "@/lib/auth/admin-identity" ||
    specifier.endsWith("/lib/auth/admin-identity")
  );
}

/** `hooksGlobalName` is the suite's hook object on globalThis, e.g. "__tbSecTestHooks". */
export function authSeamStubUrl(hooksGlobalName: string): string {
  const source = `
const signedInUser = async () => {
  const client = await globalThis.${hooksGlobalName}.createSupabaseClient();
  const result = await client.auth.getUser();
  return result && !result.error && result.data && result.data.user ? result.data.user : null;
};
export const getSessionUser = async () => signedInUser();
export const isAdminSignInConfigured = () => true;
export const getAdminIdentity = async () => {
  const user = await signedInUser();
  return user && user.id
    ? { status: "signed-in", userId: user.id, sessionId: "test-session" }
    : { status: "signed-out" };
};
`;
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
