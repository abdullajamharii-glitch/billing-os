import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/api-response';
import { cookies } from 'next/headers';

export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => {});
  }

  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');

  return ok({ message: 'Logged out successfully' });
}
