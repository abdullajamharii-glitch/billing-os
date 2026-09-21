import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import type { Role } from '@prisma/client';

const getAccessSecret = () =>
  new TextEncoder().encode(process.env.JWT_ACCESS_SECRET || 'dev-access-secret-billing-os-2026');

const getRefreshSecret = () =>
  new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-billing-os-2026');

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

export interface JwtPayload {
  sub: string;    // userId
  orgId: string;
  role: Role;
  name: string;
  email: string;
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({
    sub: payload.sub,
    orgId: payload.orgId,
    role: payload.role,
    name: payload.name,
    email: payload.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRES)
    .sign(getAccessSecret());
}

export async function signRefreshToken(payload: Pick<JwtPayload, 'sub' | 'orgId'>): Promise<string> {
  return new SignJWT({
    sub: payload.sub,
    orgId: payload.orgId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRES)
    .sign(getRefreshSecret());
}

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

export async function verifyRefreshToken(token: string): Promise<Pick<JwtPayload, 'sub' | 'orgId'> | null> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecret());
    return {
      sub: payload.sub as string,
      orgId: payload.orgId as string,
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export function refreshTokenExpiryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}
