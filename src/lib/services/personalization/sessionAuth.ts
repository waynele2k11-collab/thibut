import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  ANON_SESSION_COOKIE,
  signAnonSessionToken,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { getSessionUser } from "@/lib/auth/session";

export const ANON_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

export class PersonalizationAuthError extends Error {
  public readonly status = 401 as const;

  constructor(message: string) {
    super(message);
    this.name = "PersonalizationAuthError";
  }
}

export function readCookieFromRequestHeader(
  request: Request,
  cookieName: string
): string | undefined {
  const rawHeader = request.headers.get("cookie");
  if (!rawHeader) return undefined;
  for (const part of rawHeader.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === cookieName) {
      return decodeURIComponent(part.slice(eqIdx + 1).trim());
    }
  }
  return undefined;
}

export async function getCookieValue(
  request: Request,
  cookieName: string
): Promise<string | undefined> {
  const fromHeader = readCookieFromRequestHeader(request, cookieName);
  if (fromHeader !== undefined) {
    return fromHeader;
  }
  try {
    const cookieStore = await cookies();
    return cookieStore.get(cookieName)?.value;
  } catch {
    return undefined;
  }
}

export async function resolveAuthenticatedDbUserId(): Promise<string | null> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return null;
    }

    const byId = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, status: true },
    });
    if (byId && (!byId.status || byId.status === "ACTIVE")) {
      return byId.id;
    }

    if (user.email) {
      const byEmail = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true, status: true },
      });
      if (byEmail && (!byEmail.status || byEmail.status === "ACTIVE")) {
        return byEmail.id;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function attachAnonCookieIfNeeded(
  response: NextResponse,
  token: string | null
): NextResponse {
  if (token) {
    response.cookies.set(ANON_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ANON_COOKIE_TTL_SECONDS,
      path: "/",
    });
  }
  return response;
}

export interface MintableStudioCaller {
  userId: string | null;
  anonymousSessionId: string | null;
  newlyIssuedAnonToken: string | null;
  actorKey: string;
}

export async function resolveOrMintAnonSession(params: {
  request: Request;
  onBeforeMint?: () => Promise<void>;
}): Promise<MintableStudioCaller> {
  const userId = await resolveAuthenticatedDbUserId();
  let anonymousSessionId: string | null = null;
  let newlyIssuedAnonToken: string | null = null;

  if (!userId) {
    const existingAnonToken = await getCookieValue(
      params.request,
      ANON_SESSION_COOKIE
    );
    if (existingAnonToken !== undefined) {
      const verifiedAnonId = await verifyAnonSessionToken(existingAnonToken);
      if (!verifiedAnonId) {
        throw new PersonalizationAuthError(
          "Invalid or expired anonymous session"
        );
      }
      anonymousSessionId = verifiedAnonId;
    } else {
      await params.onBeforeMint?.();
      const minted = await signAnonSessionToken(
        undefined,
        ANON_COOKIE_TTL_SECONDS
      );
      anonymousSessionId = minted.anonId;
      newlyIssuedAnonToken = minted.token;
    }
  }

  return {
    userId,
    anonymousSessionId,
    newlyIssuedAnonToken,
    actorKey: userId ?? `anon:${anonymousSessionId}`,
  };
}

export interface VerifiedStudioCaller {
  userId: string | null;
  anonymousSessionId: string | null;
  actorKey: string;
}

export async function requireStudioCaller(
  request: Request
): Promise<VerifiedStudioCaller> {
  const userId = await resolveAuthenticatedDbUserId();
  let anonymousSessionId: string | null = null;

  if (!userId) {
    const existingAnonToken = await getCookieValue(
      request,
      ANON_SESSION_COOKIE
    );
    if (!existingAnonToken) {
      throw new PersonalizationAuthError(
        "Authentication or valid studio session required"
      );
    }
    const verifiedAnonId = await verifyAnonSessionToken(existingAnonToken);
    if (!verifiedAnonId) {
      throw new PersonalizationAuthError(
        "Invalid or expired anonymous session"
      );
    }
    anonymousSessionId = verifiedAnonId;
  }

  return {
    userId,
    anonymousSessionId,
    actorKey: userId ?? `anon:${anonymousSessionId}`,
  };
}
