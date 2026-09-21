import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { comparePassword, signAccessToken, signRefreshToken, refreshTokenExpiryDate } from '@/lib/auth';
import { ok, unauthorized, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { cookies } from 'next/headers';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(LoginSchema, body);
    if (error) return error;

    const user = await prisma.user.findFirst({
      where: { email: data.email, isActive: true },
      include: { org: true },
    });
    if (!user) return unauthorized('Invalid email or password');

    const passwordMatch = await comparePassword(data.password, user.passwordHash);
    if (!passwordMatch) return unauthorized('Invalid email or password');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const accessToken = await signAccessToken({
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
      name: user.name,
      email: user.email,
    });
    const refreshTokenStr = await signRefreshToken({ sub: user.id, orgId: user.orgId });

    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshTokenStr, expiresAt: refreshTokenExpiryDate() },
    });

    const cookieStore = await cookies();
    cookieStore.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });
    cookieStore.set('refresh_token', refreshTokenStr, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
        orgName: user.org.name,
        orgCurrency: user.org.currency,
      },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return serverError();
  }
}
