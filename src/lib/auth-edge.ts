/**
 * Edge-safe JWT utilities — used exclusively by middleware.ts
 *
 * This file MUST NOT import:
 *  - bcryptjs (uses process.nextTick / setImmediate)
 *  - @prisma/client (Node.js only)
 *  - next/headers (not available in Edge Runtime)
 *  - from 'jose' directly — the barrel export pulls in jose/dist/webapi/index.js
 *    which re-exports JWE decrypt → jwe_decrypt.js → deflate.js → CompressionStream
 *
 * ✅ Safe: import from the specific subpath 'jose/jwt/verify'
 *    This loads ONLY the JWT verification code, no JWE, no CompressionStream.
 */
import { jwtVerify } from 'jose/jwt/verify';
import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;    // userId
  orgId: string;
  role: Role;
  name: string;
  email: string;
}

const getAccessSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_ACCESS_SECRET || 'dev-access-secret-billing-os-2026'
  );

/**
 * Verify an access token — Edge Runtime safe.
 * Returns the decoded payload or null if invalid / expired.
 */
export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessSecret());
    return {
      sub: payload.sub as string,
      orgId: payload.orgId as string,
      role: payload.role as Role,
      name: payload.name as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}
