import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, serverError } from '@/lib/api-response';

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: session.sub, isActive: true },
      include: { org: true },
    });
    if (!user) return unauthorized();

    return ok({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      orgName: user.org.name,
      orgCurrency: user.org.currency,
    });
  } catch (err) {
    console.error('[auth/me]', err);
    return serverError();
  }
}
