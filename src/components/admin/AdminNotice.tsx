/** Result banner for admin form actions, driven by `?notice=` / `?error=` on the page URL. */
export function AdminNotice({
  notice,
  error,
}: {
  notice?: string;
  error?: string;
}) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded border border-error bg-error-container text-on-error-container px-4 py-3 font-body-md text-body-md"
      >
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p
        role="status"
        className="rounded border border-primary bg-surface-container-lowest text-on-background px-4 py-3 font-body-md text-body-md"
      >
        {notice}
      </p>
    );
  }
  return null;
}

export const ADMIN_LABEL =
  "block font-label-caps text-label-caps uppercase text-on-surface-variant mb-1.5";
export const ADMIN_FIELD =
  "h-11 w-full rounded border border-outline-variant bg-surface-container-lowest px-3 font-body-md text-body-md text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";
export const ADMIN_BUTTON =
  "inline-flex items-center justify-center min-h-11 bg-primary text-on-primary px-5 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";
export const ADMIN_TAB =
  "inline-flex items-center min-h-11 px-4 rounded border border-outline-variant font-label-caps text-label-caps uppercase text-on-surface hover:bg-surface-container-high transition-colors motion-reduce:transition-none";
