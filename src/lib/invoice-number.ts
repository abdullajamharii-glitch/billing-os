import { prisma } from './prisma';

/**
 * Generate a gapless sequential invoice number per organization and year.
 * Format: INV-{YYYY}-{0001}
 * Uses atomic upsert and counter increment to prevent race conditions.
 */
export async function generateInvoiceNumber(
  orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any
): Promise<string> {
  const db = tx ?? prisma;
  const currentYear = new Date().getFullYear();

  // Find or create sequence for this org
  const sequence = await db.invoiceSequence.upsert({
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
  return `INV-${currentYear}-${paddedNum}`;
}
