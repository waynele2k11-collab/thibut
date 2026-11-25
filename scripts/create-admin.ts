/**
 * Sets up the single Thi Bút admin account. Run by the founder, on the founder's own computer.
 *
 *   node --env-file=<settings file> --import ./scripts/test-loader.mjs scripts/create-admin.ts
 *   node --env-file=<settings file> --import ./scripts/test-loader.mjs scripts/create-admin.ts --reset-authenticator
 *   node --env-file=<settings file> --import ./scripts/test-loader.mjs scripts/create-admin.ts --clear-lockout
 *   node --env-file=<settings file> --import ./scripts/test-loader.mjs scripts/create-admin.ts --forgot-password
 *   node --env-file=<settings file> --import ./scripts/test-loader.mjs scripts/create-admin.ts --check-code
 *
 * No option: create the admin, or (after the CURRENT password is checked) replace the password,
 * authenticator and recovery codes. --reset-authenticator: new authenticator and recovery codes,
 * password unchanged. --clear-lockout: end a sign-in lockout (deletes the unsuccessful sign-in
 * tries and nothing else). --forgot-password: replace everything without the current password,
 * after you type a confirmation phrase.
 *
 * The settings file must hold DATABASE_URL (and DATABASE_URL_UNPOOLED) for the database the
 * website uses, and ADMIN_SESSION_SECRET with EXACTLY the value the website runs with: that
 * secret protects the authenticator secret this command stores.
 *
 * Nothing secret is taken from the command line. The email and password are asked for; the
 * password is not shown while typed. The authenticator setup key and the recovery codes are
 * printed ONCE, here, and are not stored anywhere in readable form.
 *
 * Before it writes anything it shows the HOST NAME and database name it is connected to (never
 * the user name or password in the address) and asks you to confirm. Check it: a `.env` file in
 * this folder is read automatically when --env-file is left out, and may point somewhere else.
 *
 * It refuses to run on Vercel. It never prints the password or any setting's value.
 */
import readline from "node:readline";
import { PrismaClient } from "@prisma/client";
import {
  clearAdminLockout,
  enrolAdmin,
  resetAdminAuthenticator,
  type AdminAccountWrite,
  type AdminEnrolmentFailure,
  type AdminEnrolmentResult,
  type AdminEnrolmentStore,
} from "../src/lib/auth/admin-enrolment";
import { PASSWORD_MIN_LENGTH } from "../src/lib/auth/password";
import { ADMIN_SECRET_MIN_LENGTH, deriveAdminKey, openSecret } from "../src/lib/auth/secret-box";
import { hotp, normalizeTotpInput, timeStepAt, TOTP_STEP_SECONDS } from "../src/lib/auth/totp";
import { isPlaceholderSecret } from "../src/lib/security/placeholder";

const RESET_FLAG = "--reset-authenticator";
const CLEAR_LOCKOUT_FLAG = "--clear-lockout";
const FORGOT_PASSWORD_FLAG = "--forgot-password";
const CHECK_CODE_FLAG = "--check-code";
const KNOWN_FLAGS = [RESET_FLAG, CLEAR_LOCKOUT_FLAG, FORGOT_PASSWORD_FLAG, CHECK_CODE_FLAG];
const FORGOT_PASSWORD_PHRASE = "replace the admin";

const FAILURE_TEXT: Record<AdminEnrolmentFailure, string> = {
  "invalid-email": "That is not an email address.",
  "weak-password": `The password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  "another-admin-exists":
    "A different user already holds the admin sign-in. Run this again with that user's email.",
  "no-such-admin": "No admin with that email has been set up yet. Run this without the flag first.",
  "wrong-password": "That password is not the admin's current password.",
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function askVisible(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Reads a line without showing it. Escape sequences (arrow keys and the like) are ignored. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const finish = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      // A whole escape sequence arrives as one chunk; drop it.
      if (chunk.length > 1 && chunk.startsWith("\u001b")) return;
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u0003" || char === "\u0004") return finish(new Error("Cancelled"));
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (char < " ") continue;
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

function prismaEnrolmentStore(prisma: PrismaClient): AdminEnrolmentStore {
  return {
    async findCredentialOwner() {
      const row = await prisma.adminCredential.findFirst({
        select: { userId: true, user: { select: { email: true } } },
      });
      return row ? { userId: row.userId, email: row.user.email } : null;
    },
    async findUserIdByEmail(email: string) {
      const row = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      return row?.id ?? null;
    },
    async findPasswordHash(userId: string) {
      const row = await prisma.adminCredential.findUnique({
        where: { userId },
        select: { passwordHash: true },
      });
      return row?.passwordHash ?? null;
    },
    async writeAdminAccount(input: AdminAccountWrite) {
      return prisma.$transaction(async (tx) => {
        const role = await tx.role.upsert({
          where: { code: "ADMIN" },
          update: {},
          create: { code: "ADMIN", name: "Administrator" },
        });
        const user = input.existingUserId
          ? await tx.user.update({
              where: { id: input.existingUserId },
              data: { status: "ACTIVE" },
              select: { id: true },
            })
          : await tx.user.create({
              data: { email: input.email, name: "Admin", status: "ACTIVE" },
              select: { id: true },
            });
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: role.id } },
          update: {},
          create: { userId: user.id, roleId: role.id },
        });
        if (input.passwordHash) {
          await tx.adminCredential.upsert({
            where: { userId: user.id },
            update: {
              passwordHash: input.passwordHash,
              totpSecretSealed: input.totpSecretSealed,
              totpLastStep: null,
            },
            create: {
              userId: user.id,
              passwordHash: input.passwordHash,
              totpSecretSealed: input.totpSecretSealed,
            },
          });
        } else {
          await tx.adminCredential.update({
            where: { userId: user.id },
            data: { totpSecretSealed: input.totpSecretSealed, totpLastStep: null },
          });
        }
        await tx.adminRecoveryCode.deleteMany({ where: { userId: user.id } });
        await tx.adminRecoveryCode.createMany({
          data: input.recoveryCodeHashes.map((codeHash) => ({ userId: user.id, codeHash })),
        });
        await tx.adminSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: input.now },
        });
        await tx.adminSignInChallenge.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: input.now },
        });
        return { userId: user.id };
      });
    },
    // One DELETE. Successful tries stay: they are the record of past sign-ins.
    async clearUnsuccessfulAttempts() {
      const result = await prisma.adminLoginAttempt.deleteMany({ where: { succeeded: false } });
      return result.count;
    },
  };
}

/** Host and database name only. The user name and password in the address are never shown. */
function describeDatabase(url: string): { host: string; database: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return null;
    return {
      host: parsed.hostname,
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "(default)",
    };
  } catch {
    return null;
  }
}

/**
 * --check-code: says why an authenticator code is refused. Reads only; changes nothing and
 * signs nobody in. Never prints the secret or a valid code.
 */
async function checkCode(prisma: PrismaClient, email: string, masterSecret: string): Promise<void> {
  const credential = await prisma.adminCredential.findFirst({
    where: { user: { email: { equals: email.trim(), mode: "insensitive" } } },
    select: { totpSecretSealed: true },
  });
  if (!credential) {
    fail("No admin with that email has been set up in this database.");
  }
  const secret = openSecret(
    credential.totpSecretSealed,
    deriveAdminKey(masterSecret, "totp-secret")
  );
  if (!secret) {
    fail(
      "CAUSE FOUND: the ADMIN_SESSION_SECRET in this settings file is not the one that was in use when the admin was created, so the authenticator secret cannot be read. Run this command again with --reset-authenticator, using the same settings file the website uses, and set the authenticator app up again with the new key."
    );
  }
  console.log("The authenticator secret can be read with this settings file. Good.");
  const typed = await askVisible("Type the six-digit code your app shows right now: ");
  const code = normalizeTotpInput(typed);
  if (!code) fail("That is not a six-digit code.");
  const current = timeStepAt(Date.now());
  const window = 40; // 20 minutes either side
  let offset: number | null = null;
  for (let delta = -window; delta <= window; delta++) {
    if (current + delta >= 0 && hotp(secret, current + delta) === code) {
      if (offset === null || Math.abs(delta) < Math.abs(offset)) offset = delta;
    }
  }
  if (offset === null) {
    console.log(
      "RESULT: that code does not belong to this admin's authenticator key at any time within 20 minutes of now. The key in your app is not the one stored here: it was mistyped, or it is from an earlier set-up. Delete the Thi Bút entry in the app, run this command with --reset-authenticator, and enter the new key."
    );
  } else if (Math.abs(offset) <= 1) {
    console.log(
      "RESULT: the code is correct for this key and this computer's clock. If the website still refuses it, the website is running with a different ADMIN_SESSION_SECRET or a different database than this settings file, or the five-minute step or its five tries ran out: choose Start again and type a fresh code."
    );
  } else {
    console.log(
      `RESULT: the code belongs to this key but for a time about ${Math.abs(offset) * TOTP_STEP_SECONDS} seconds ${offset < 0 ? "behind" : "ahead of"} this computer's clock. Set the phone and this computer to automatic time, then try again.`
    );
  }
}

function printSecrets(result: Extract<AdminEnrolmentResult, { ok: true }>): void {
  const lines = [
    "",
    "════════════════════════════════════════════════════════════════",
    "  Shown ONCE. Nothing below is stored anywhere in readable form.",
    "════════════════════════════════════════════════════════════════",
    "",
    "1. Open your authenticator app (Google Authenticator, Authy, 1Password…),",
    '   choose "Enter a setup key" and type:',
    "",
    `     Account name:  ${result.email}`,
    `     Setup key:     ${result.setupKey}`,
    "     Type of key:   Time based",
    "",
    "   Or paste this address if your app accepts one:",
    `     ${result.otpAuthUri}`,
    "",
    "2. Write these recovery codes on paper and keep them somewhere safe.",
    "   Each one signs you in once if you lose your phone:",
    "",
    ...result.recoveryCodes.map((code) => `     ${code}`),
    "",
    "3. Clear this terminal window when you are done (Command+K on a Mac).",
    "",
  ];
  console.log(lines.join("\n"));
}

async function main(): Promise<void> {
  if (process.env.VERCEL) {
    fail("This command runs on your own computer only. It refuses to run on Vercel.");
  }
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => !KNOWN_FLAGS.includes(arg));
  if (unknown.length > 0 || args.length > 1) {
    fail(
      `Use no option, or exactly one of: ${KNOWN_FLAGS.join(", ")}. The email and password are asked for; do not put them on the command line.`
    );
  }
  const resetOnly = args.includes(RESET_FLAG);
  const clearLockoutOnly = args.includes(CLEAR_LOCKOUT_FLAG);
  const forgotPassword = args.includes(FORGOT_PASSWORD_FLAG);
  const checkCodeOnly = args.includes(CHECK_CODE_FLAG);

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail("Run this in a terminal window: it asks for a password that must not be shown.");
  }
  if (!process.env.DATABASE_URL?.trim()) {
    fail("DATABASE_URL is not set. Start the command with --env-file=<your settings file>.");
  }
  const masterSecret = process.env.ADMIN_SESSION_SECRET ?? "";
  if (masterSecret.trim().length < ADMIN_SECRET_MIN_LENGTH) {
    fail(
      `ADMIN_SESSION_SECRET is not set or is shorter than ${ADMIN_SECRET_MIN_LENGTH} characters. It must be exactly the value the website uses.`
    );
  }
  if (isPlaceholderSecret(masterSecret)) {
    fail(
      "ADMIN_SESSION_SECRET is still the placeholder from .env.example. Set a random value, the same one the website uses."
    );
  }

  const target = describeDatabase(process.env.DATABASE_URL ?? "");
  if (!target) {
    fail("DATABASE_URL is not a database address this command can read.");
  }
  console.log(`\nDatabase host: ${target.host}\nDatabase name: ${target.database}\n`);
  const confirmTarget = await askVisible(
    "Is this the database the website uses? Type yes to continue: "
  );
  if (confirmTarget !== "yes") fail("Nothing was changed.");

  const prisma = new PrismaClient();
  if (!("adminCredential" in prisma)) {
    fail(
      "The database client is out of date. Run `npx prisma generate`, then run this command again."
    );
  }
  try {
    const deps = { store: prismaEnrolmentStore(prisma), now: () => new Date(), masterSecret };
    const email = await askVisible("Admin email: ");

    if (checkCodeOnly) {
      await checkCode(prisma, email, masterSecret);
      return;
    }

    if (clearLockoutOnly) {
      const password = await askHidden("Current admin password (not shown): ");
      const cleared = await clearAdminLockout(deps, { email, password });
      if (!cleared.ok) fail(`${FAILURE_TEXT[cleared.reason]} Nothing was changed.`);
      console.log(
        `The sign-in lockout was cleared: ${cleared.removed} unsuccessful ${cleared.removed === 1 ? "try" : "tries"} removed. Nothing else was changed. You can sign in now.`
      );
      return;
    }

    let result: AdminEnrolmentResult;
    if (resetOnly) {
      const password = await askHidden("Current admin password (not shown): ");
      result = await resetAdminAuthenticator(deps, { email, password });
    } else {
      const owner = await deps.store.findCredentialOwner();
      let currentPassword: string | undefined;
      if (owner) {
        const answer = await askVisible(
          "An admin is already set up. Replace the password, authenticator and recovery codes, and sign out every session? Type yes to continue: "
        );
        if (answer !== "yes") fail("Nothing was changed.");
        if (forgotPassword) {
          const phrase = await askVisible(
            `You chose ${FORGOT_PASSWORD_FLAG}: the current password will NOT be checked. Type "${FORGOT_PASSWORD_PHRASE}" to continue: `
          );
          if (phrase !== FORGOT_PASSWORD_PHRASE) fail("Nothing was changed.");
        } else {
          currentPassword = await askHidden("Current admin password (not shown): ");
        }
      }
      const password = await askHidden(
        `New admin password, at least ${PASSWORD_MIN_LENGTH} characters (not shown): `
      );
      const again = await askHidden("The same password again: ");
      if (password !== again) fail("The two passwords are different. Nothing was changed.");
      result = await enrolAdmin(deps, {
        email,
        password,
        currentPassword,
        forgotPassword: forgotPassword && owner !== null,
      });
    }

    if (!result.ok) fail(`${FAILURE_TEXT[result.reason]} Nothing was changed.`);
    console.log(
      resetOnly
        ? "The authenticator and recovery codes were replaced. Every admin session was signed out."
        : result.replacedExisting
          ? "The admin was updated. Every admin session was signed out."
          : "The admin was created."
    );
    printSecrets(result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // The error class and, for database errors, the short error code only: a database error
  // message can contain the connection address.
  const name = error instanceof Error ? error.name : "UnknownError";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code).slice(0, 12)
      : "";
  console.error(`The command stopped with an error: ${name}${code ? ` (${code})` : ""}`);
  if (code === "P2021" || code === "P2022") {
    console.error(
      "The sign-in tables are missing. Run the database migration first, then run this again."
    );
  }
  process.exit(1);
});
