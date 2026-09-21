import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRefreshToken, signAccessToken, signRefreshToken, refreshTokenExpiryDate } from '@/lib/auth';
import { ok, unauthorized, serverError } from '@/lib/api-response';
import { cookies } from 'next/headers';

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;
    if (!refreshToken) return unauthorized('No refresh token');

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) return unauthorized('Invalid or expired refresh token');

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) return unauthorized('Refresh token expired or revoked');

    const user = await prisma.user.findUnique({
      where: { id: payload.sub, isActive: true },
      include: { org: true },
    });
    if (!user) return unauthorized('User not found');

    // Rotate refresh token
    const newRefreshToken = await signRefreshToken({ sub: user.id, orgId: user.orgId });
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { token: refreshToken } }),
      prisma.refreshToken.create({
        data: { userId: user.id, token: newRefreshToken, expiresAt: refreshTokenExpiryDate() },
      }),
    ]);

    const accessToken = await signAccessToken({
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    cookieStore.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });
    cookieStore.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return ok({ message: 'Token refreshed' });
  } catch (err) {
    console.error('[auth/refresh]', err);
    return serverError();
  }
}
