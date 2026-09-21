import { prisma } from './prisma';

/**
 * Generate a sequential retail bill number per shop and year.
 * Format: BILL-{YYYY}-{0001}
 */
export async function generateBillNumber(
  orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any
): Promise<string> {
  const db = tx ?? prisma;
  const currentYear = new Date().getFullYear();

  const sequence = await db.saleSequence.upsert({
    where: { orgId },
    update: {
      lastNum: { increment: 1 },
    },
    create: {
      orgId,
      year: currentYear,
      lastNum: 1,
    },
  });

  const paddedNum = String(sequence.lastNum).padStart(4, '0');
  return `BILL-${currentYear}-${paddedNum}`;
}
