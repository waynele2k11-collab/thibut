/**
 * A small in-memory stand-in for the Prisma delegates the admin sign-in code calls, so the
 * REAL database store (src/lib/auth/admin-store.ts) and the REAL guard run in tests.
 *
 * It evaluates the same `where` shapes the store sends (equality, null, gt/gte/lt, in, not null,
 * OR, and the nested `user.email`), honours `orderBy` on `findFirst`, and applies `updateMany` as one uninterrupted check-and-write after a
 * yield, like a single SQL statement. An unknown operator throws, so a query the fake cannot
 * honour is never silently treated as a match.
 */
import crypto from "node:crypto";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function yieldToOthers(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function compare(value: unknown, condition: unknown): boolean {
  if (condition === null || typeof condition !== "object" || condition instanceof Date) {
    if (condition instanceof Date && value instanceof Date) {
      return value.getTime() === condition.getTime();
    }
    return value === condition;
  }
  const ops = condition as Record<string, unknown>;
  for (const [op, operand] of Object.entries(ops)) {
    if (op === "in") {
      if (!(operand as unknown[]).includes(value)) return false;
      continue;
    }
    if (op === "not") {
      if (operand !== null) throw new Error('fake prisma: only "not: null" is supported');
      if (value === null || value === undefined) return false;
      continue;
    }
    const left = value instanceof Date ? value.getTime() : (value as number | null);
    const right = operand instanceof Date ? operand.getTime() : (operand as number);
    if (left === null || left === undefined) return false;
    if (op === "gt") {
      if (!(left > right)) return false;
    } else if (op === "gte") {
      if (!(left >= right)) return false;
    } else if (op === "lt") {
      if (!(left < right)) return false;
    } else {
      throw new Error(`fake prisma: unsupported operator "${op}"`);
    }
  }
  return true;
}

export interface FakeUserRow {
  id: string;
  email: string | null;
  status: string;
  roles: Array<{ role: { code: string } }>;
}

export class FakeAdminPrisma {
  users = new Map<string, FakeUserRow>();
  tables: Record<string, Row[]> = {
    adminCredential: [],
    adminRecoveryCode: [],
    adminSession: [],
    adminSignInChallenge: [],
    adminLoginAttempt: [],
  };
  /** Set to make every call fail, as an unreachable database would. */
  failWith: Error | null = null;

  private matches(table: string, row: Row, where: Where): boolean {
    for (const [field, condition] of Object.entries(where)) {
      if (field === "OR") {
        const options = condition as Where[];
        if (!options.some((option) => this.matches(table, row, option))) return false;
        continue;
      }
      if (field === "user") {
        const user = this.users.get(row.userId as string);
        const wanted = condition as { email?: string };
        if (!user || user.email !== wanted.email) return false;
        continue;
      }
      if (!(field in row)) {
        throw new Error(`fake prisma: ${table} has no column "${field}"`);
      }
      if (!compare(row[field], condition)) return false;
    }
    return true;
  }

  private async begin(): Promise<void> {
    await yieldToOthers();
    if (this.failWith) throw this.failWith;
  }

  private withUser(row: Row | undefined): Row | null {
    if (!row) return null;
    const user = this.users.get(row.userId as string);
    return { ...row, user: user ? { email: user.email, status: user.status, roles: user.roles } : null };
  }

  private delegate(table: string, defaults: Row) {
    return {
      create: async (args: { data: Row }) => {
        await this.begin();
        const row: Row = { id: crypto.randomUUID(), ...defaults, ...args.data };
        this.tables[table].push(row);
        return { ...row };
      },
      findUnique: async (args: { where: Where; include?: unknown }) => {
        await this.begin();
        const row = this.tables[table].find((r) => this.matches(table, r, args.where));
        return args.include ? this.withUser(row) : row ? { ...row } : null;
      },
      findFirst: async (args: {
        where: Where;
        include?: unknown;
        orderBy?: Record<string, "asc" | "desc">;
      }) => {
        await this.begin();
        let rows = this.tables[table].filter((r) => this.matches(table, r, args.where));
        if (args.orderBy) {
          const [[field, direction]] = Object.entries(args.orderBy);
          const rank = (r: Row) =>
            r[field] instanceof Date ? (r[field] as Date).getTime() : (r[field] as number);
          rows = [...rows].sort((a, b) =>
            direction === "desc" ? rank(b) - rank(a) : rank(a) - rank(b)
          );
        }
        const row = rows[0];
        return args.include ? this.withUser(row) : row ? { ...row } : null;
      },
      count: async (args: { where: Where }) => {
        await this.begin();
        return this.tables[table].filter((r) => this.matches(table, r, args.where)).length;
      },
      updateMany: async (args: { where: Where; data: Row }) => {
        await this.begin();
        const rows = this.tables[table].filter((r) => this.matches(table, r, args.where));
        for (const row of rows) {
          for (const [field, value] of Object.entries(args.data)) {
            if (value !== null && typeof value === "object" && !(value instanceof Date)) {
              const change = value as { increment?: number };
              if (typeof change.increment !== "number") {
                throw new Error(`fake prisma: unsupported update on "${field}"`);
              }
              row[field] = (row[field] as number) + change.increment;
            } else {
              row[field] = value;
            }
          }
        }
        return { count: rows.length };
      },
      deleteMany: async (args: { where: Where }) => {
        await this.begin();
        const before = this.tables[table].length;
        this.tables[table] = this.tables[table].filter((r) => !this.matches(table, r, args.where));
        return { count: before - this.tables[table].length };
      },
    };
  }

  /** The object handed to the code under test in place of `@/lib/prisma`. */
  client() {
    return {
      user: {
        findUnique: async (args: { where: { id?: string; email?: string } }) => {
          await this.begin();
          if (args.where.id) return this.users.get(args.where.id) ?? null;
          for (const user of this.users.values()) {
            if (args.where.email && user.email === args.where.email) return user;
          }
          return null;
        },
      },
      adminCredential: this.delegate("adminCredential", { totpLastStep: null }),
      adminRecoveryCode: this.delegate("adminRecoveryCode", { usedAt: null }),
      adminSession: this.delegate("adminSession", { revokedAt: null }),
      adminSignInChallenge: this.delegate("adminSignInChallenge", { tries: 0, consumedAt: null }),
      adminLoginAttempt: this.delegate("adminLoginAttempt", { succeeded: false, refused: false }),
    };
  }
}
