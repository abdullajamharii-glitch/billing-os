import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, signAccessToken, signRefreshToken, refreshTokenExpiryDate } from '@/lib/auth';
import { created, conflict, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { writeAuditLog } from '@/lib/audit';
import { cookies } from 'next/headers';

const RegisterSchema = z.object({
  orgName: z.string().min(2).max(100),
  gstin: z.string().optional(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  timezone: z.string().default('Asia/Kolkata'),
  defaultCurrency: z.string().default('INR'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(RegisterSchema, body);
    if (error) return error;

    const existingUser = await prisma.user.findFirst({ where: { email: data.email } });
    if (existingUser) return conflict('An account with this email already exists');

    const passwordHash = await hashPassword(data.password);

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.orgName,
          gstin: data.gstin,
        },
      });

      const user = await tx.user.create({
        data: {
          orgId: org.id,
          name: data.name,
          email: data.email,
          passwordHash,
          role: 'OWNER',
        },
      });

      const refreshTokenStr = await signRefreshToken({ sub: user.id, orgId: org.id });
      await tx.refreshToken.create({
        data: { userId: user.id, token: refreshTokenStr, expiresAt: refreshTokenExpiryDate() },
      });

      await writeAuditLog(
        { orgId: org.id, actorUserId: user.id, entity: 'Organization', entityId: org.id, action: 'CREATE', after: { name: org.name } },
        tx
      );

      return { org, user, refreshToken: refreshTokenStr };
    });

    const accessToken = await signAccessToken({
      sub: result.user.id,
      orgId: result.org.id,
      role: result.user.role,
      name: result.user.name,
      email: result.user.email,
    });

    const cookieStore = await cookies();
    cookieStore.set('access_token', accessToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 15 * 60, path: '/',
    });
    cookieStore.set('refresh_token', result.refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 7 * 24 * 60 * 60, path: '/',
    });

    return created({
      user: {
        id: result.user.id, name: result.user.name, email: result.user.email,
        role: result.user.role, orgId: result.org.id, orgName: result.org.name,
      },
    });
  } catch (err) {
    console.error('[auth/register]', err);
    return serverError();
  }
}
