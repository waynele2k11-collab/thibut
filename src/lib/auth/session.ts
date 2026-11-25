import "server-only";

/**
 * The signed-in CUSTOMER of the current request, or null for a guest.
 *
 * Thi Bút has no customer or creator accounts at present: buyers check out as guests (signed
 * `tb_anon_session` cookie) and custom orders use a private link. So this always answers
 * "guest". It is the single seam every customer-side caller goes through; when customer
 * accounts return, this function is the only place that changes.
 *
 * It must never return the admin: admin access is decided only by `requireAdmin` and
 * `assertAdminApi` in src/utils/admin/auth.ts.
 */
export interface SessionUser {
  id: string;
  email?: string | null;
  phone?: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return null;
}
