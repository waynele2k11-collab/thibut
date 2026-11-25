/**
 * What the admin is told about sign-in activity after signing in. Pure.
 *
 * A wrong authenticator or recovery code is only ever recorded after a CORRECT password, so
 * any such try the admin did not make means someone else knows the password.
 */
export interface AdminSignInReport {
  /** When the admin signed in before this session, if that is still on record. */
  previousSignInAt: Date | null;
  /** Wrong authenticator or recovery codes between the previous sign-in and this one. */
  failedCodeTries: number;
  recoveryCodesLeft: number;
  /** The newest use of a recovery code, if any was ever used. */
  lastRecoveryCodeUsedAt: Date | null;
  /** True when that use happened after the previous sign-in (this sign-in included). */
  recoveryCodeUsedSinceLastSignIn: boolean;
}

export interface AdminSignInNotice {
  tone: "warning" | "info";
  text: string;
}

function formatWhen(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function describeSignInReport(report: AdminSignInReport): AdminSignInNotice[] {
  const notices: AdminSignInNotice[] = [];
  if (report.failedCodeTries > 0) {
    const tries =
      report.failedCodeTries === 1
        ? "1 failed code attempt"
        : `${report.failedCodeTries} failed code attempts`;
    notices.push({
      tone: "warning",
      text: `${tries} since your last sign-in. A code is only asked for after the correct password. If these were not you, someone knows your password: set a new one with the create-admin command.`,
    });
  }
  if (report.recoveryCodeUsedSinceLastSignIn && report.lastRecoveryCodeUsedAt) {
    notices.push({
      tone: "warning",
      text: `A recovery code was used on ${formatWhen(report.lastRecoveryCodeUsedAt)}. ${report.recoveryCodesLeft} left. If that was not you, set a new password and authenticator with the create-admin command.`,
    });
  } else if (report.recoveryCodesLeft <= 3) {
    notices.push({
      tone: "info",
      text: `${report.recoveryCodesLeft} recovery ${report.recoveryCodesLeft === 1 ? "code" : "codes"} left. Run the create-admin command with --reset-authenticator to get ten new ones.`,
    });
  }
  return notices;
}
