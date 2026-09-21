import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession, hashPassword } from '@/lib/auth';
import { ok, created, unauthorized, forbidden, conflict, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { writeAuditLog } from '@/lib/audit';

const InviteUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'VIEWER']),
});

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!['OWNER', 'ADMIN'].includes(session.role)) return forbidden();

    const users = await prisma.user.findMany({
      where: { orgId: session.orgId },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { name: 'asc' },
    });

    return ok(users);
  } catch (err) {
    console.error('[users GET]', err);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!['OWNER', 'ADMIN'].includes(session.role)) return forbidden();

    const body = await request.json();
    const { data, error } = validateBody(InviteUserSchema, body);
    if (error) return error;

    const existing = await prisma.user.findFirst({ where: { orgId: session.orgId, email: data.email } });
    if (existing) return conflict('A user with this email already exists in your organization');

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { orgId: session.orgId, name: data.name, email: data.email, passwordHash, role: data.role },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      });
      await writeAuditLog(
        { orgId: session.orgId, actorUserId: session.sub, entity: 'User', entityId: u.id, action: 'CREATE', after: { name: u.name, email: u.email, role: u.role } },
        tx
      );
      return u;
    });

    return created(user);
  } catch (err) {
    console.error('[users POST]', err);
    return serverError();
  }
}
