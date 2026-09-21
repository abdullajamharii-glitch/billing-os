import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { created, paginated, unauthorized, badRequest, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { generateBillNumber } from '@/lib/bill-number';
import { writeAuditLog } from '@/lib/audit';

const CheckoutItemSchema = z.object({
  productId: z.string().optional().nullable(),
  productName: z.string().min(1, 'Product name required'),
  barcode: z.string().optional().nullable(),
  unit: z.string().default('pcs'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().int().min(0), // in paise
  taxRate: z.number().int().min(0).default(0), // basis points (500 = 5%)
  discount: z.number().int().min(0).default(0), // in paise
  hsnCode: z.string().optional().nullable(),
});

const CreateSaleSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().default('Walk-in Customer'),
  customerPhone: z.string().optional().nullable(),
  items: z.array(CheckoutItemSchema).min(1, 'At least 1 item is required to generate a bill'),
  discountTotal: z.number().int().min(0).default(0), // in paise
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'SPLIT', 'OTHER']).default('CASH'),
  cashReceived: z.number().int().min(0).default(0), // in paise
  paymentRef: z.string().optional().nullable(),
  razorpayOrderId: z.string().optional().nullable(),
  razorpayPaymentId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  pointsRedeemed: z.number().int().min(0).default(0), // loyalty points to redeem as discount
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? '';
    const paymentMethod = searchParams.get('paymentMethod');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '25'));

    const where: any = {
      orgId: session.orgId,
      status: 'COMPLETED',
      ...(paymentMethod ? { paymentMethod: paymentMethod as any } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { billNumber: { contains: search, mode: 'insensitive' } },
              { customerName: { contains: search, mode: 'insensitive' } },
              { customerPhone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          items: true,
          user: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.sale.count({ where }),
    ]);

    return paginated({ data: sales, page, pageSize, total });
  } catch (err) {
    console.error('[sales GET]', err);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { data, error } = validateBody(CreateSaleSchema, body);
    if (error) return error;

    // Fetch product details for cost prices & stock deduction
    const productIds = data.items
      .map((i) => i.productId)
      .filter((id): id is string => Boolean(id));

    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, orgId: session.orgId },
    });
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Calculate item lines, taxes, costs
    let calculatedSubtotal = 0;
    let calculatedTaxTotal = 0;
    let calculatedCostTotal = 0;

    const computedItems = data.items.map((item) => {
      const dbProd = item.productId ? productMap.get(item.productId) : null;
      const costPrice = dbProd ? dbProd.costPrice : 0;
      const taxRate = item.taxRate || (dbProd ? dbProd.taxRate : 0);

      const rawItemSub = Math.round(item.quantity * item.unitPrice);
      const itemTax = Math.round((rawItemSub * taxRate) / 10000);
      const lineTotal = rawItemSub + itemTax - (item.discount || 0);

      calculatedSubtotal += rawItemSub;
      calculatedTaxTotal += itemTax;
      calculatedCostTotal += Math.round(item.quantity * costPrice);

      return {
        productId: item.productId || null,
        productName: item.productName,
        barcode: item.barcode || (dbProd ? dbProd.barcode : null),
        hsnCode: item.hsnCode || (dbProd ? dbProd.hsnCode : '996331') || '996331',
        unit: item.unit || (dbProd ? dbProd.unit : 'pcs'),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice,
        taxRate,
        taxAmount: itemTax,
        discount: item.discount || 0,
        lineTotal,
      };
    });

    const finalSubtotal = calculatedSubtotal;
    const finalTaxTotal = calculatedTaxTotal;
    const halfTax = Math.round(finalTaxTotal / 2);
    const finalCgstTotal = halfTax;
    const finalSgstTotal = finalTaxTotal - halfTax;
    const finalIgstTotal = 0;

    // -------------------------------------------------------
    // Loyalty & Customer: fetch config + resolve customer record
    // -------------------------------------------------------
    let loyaltyConfig = await prisma.loyaltyConfig.findUnique({ where: { orgId: session.orgId } });
    let pointsRedeemedPaise = 0;
    let pointsToEarn = 0;
    let customerRecord = null;

    if (data.customerId) {
      customerRecord = await prisma.customer.findFirst({
        where: { id: data.customerId, orgId: session.orgId },
      });
    } else if (data.customerPhone && data.customerPhone.trim()) {
      const cleanPhone = data.customerPhone.trim();
      customerRecord = await prisma.customer.findFirst({
        where: { orgId: session.orgId, phone: cleanPhone, isActive: true },
      });

      // If new customer with phone number, auto-create customer record in database!
      if (!customerRecord && cleanPhone.length >= 5) {
        const custName = data.customerName && data.customerName !== 'Walk-in Customer'
          ? data.customerName.trim()
          : `Customer ${cleanPhone.slice(-4)}`;
        try {
          customerRecord = await prisma.customer.create({
            data: {
              orgId: session.orgId,
              name: custName,
              phone: cleanPhone,
            },
          });
        } catch (e) {
          console.warn('[sales auto-create customer failed]', e);
        }
      }
    }

    if (loyaltyConfig?.isEnabled && customerRecord) {
      // Redemption discount (in paise)
      if ((data.pointsRedeemed ?? 0) > 0) {
        const availablePoints = customerRecord.loyaltyPoints;
        const redeemPts = Math.min(data.pointsRedeemed ?? 0, availablePoints);
        pointsRedeemedPaise = redeemPts * loyaltyConfig.pointValuePaise;
      }
    }

    const redemptionDiscount = pointsRedeemedPaise;
    const grandTotal = Math.max(0, finalSubtotal + finalTaxTotal - (data.discountTotal ?? 0) - redemptionDiscount);

    const changeReturned =
      data.paymentMethod === 'CASH' && (data.cashReceived ?? 0) > grandTotal
        ? (data.cashReceived ?? 0) - grandTotal
        : 0;

    // Calculate points to earn based on grand total paid (after all discounts)
    if (loyaltyConfig?.isEnabled && customerRecord) {
      pointsToEarn = Math.floor((grandTotal / 10000) * loyaltyConfig.pointsPerHundred);
    }

    // Atomic transaction: sequential bill number + sale creation + inventory deduction + loyalty + audit log
    const completedSale = await prisma.$transaction(async (tx) => {
      const billNumber = await generateBillNumber(session.orgId, tx);

      const sale = await tx.sale.create({
        data: {
          orgId: session.orgId,
          userId: session.sub,
          customerId: customerRecord?.id || data.customerId || undefined,
          billNumber,
          customerName: customerRecord?.name || data.customerName || 'Walk-in Customer',
          customerPhone: customerRecord?.phone || data.customerPhone || undefined,
          subtotal: finalSubtotal,
          taxTotal: finalTaxTotal,
          cgstTotal: finalCgstTotal,
          sgstTotal: finalSgstTotal,
          igstTotal: finalIgstTotal,
          discountTotal: (data.discountTotal ?? 0) + redemptionDiscount,
          total: grandTotal,
          costTotal: calculatedCostTotal,
          paymentMethod: data.paymentMethod,
          cashReceived: data.cashReceived ?? 0,
          changeReturned,
          paymentRef: data.paymentRef || undefined,
          razorpayOrderId: data.razorpayOrderId || undefined,
          razorpayPaymentId: data.razorpayPaymentId || undefined,
          notes: data.notes || undefined,
          pointsEarned: pointsToEarn,
          pointsRedeemed: data.pointsRedeemed ?? 0,
          items: {
            create: computedItems,
          },
        },
        include: {
          items: true,
          org: true,
          user: { select: { id: true, name: true } },
          customer: true,
        },
      });

      // 1. Fetch any Recipe / BOM mappings for products in the cart
      const productIds = computedItems.map((i) => i.productId).filter(Boolean) as string[];
      const recipeMappings = await tx.recipeItem.findMany({
        where: {
          orgId: session.orgId,
          productId: { in: productIds },
        },
        include: {
          ingredient: { select: { id: true, name: true, unit: true, costPrice: true, stock: true } },
        },
      });

      const recipeMap = new Map<string, typeof recipeMappings>();
      for (const rm of recipeMappings) {
        const list = recipeMap.get(rm.productId) || [];
        list.push(rm);
        recipeMap.set(rm.productId, list);
      }

      // 2. Deduct stock quantities and write inventory ledger entries
      for (const item of computedItems) {
        if (!item.productId) continue;

        const recipes = recipeMap.get(item.productId);
        if (recipes && recipes.length > 0) {
          // Item has a Recipe / BOM: automatically deduct all raw kitchen ingredients!
          for (const rec of recipes) {
            const consumedQty = Number((item.quantity * rec.quantity).toFixed(3));
            if (consumedQty > 0) {
              const updatedIng = await tx.product.update({
                where: { id: rec.ingredientId },
                data: { stock: { decrement: consumedQty } },
              });

              await tx.stockEntry.create({
                data: {
                  orgId: session.orgId,
                  productId: rec.ingredientId,
                  type: 'SALE_DEDUCT',
                  qty: -consumedQty,
                  balanceAfter: Math.max(0, updatedIng.stock),
                  note: `BOM: Sold ${item.quantity}x ${item.productName} on Bill ${billNumber}`,
                  costPricePaise: rec.ingredient.costPrice,
                  createdByUserId: session.sub,
                },
              });
            }
          }

          // Also update the menu product's own stock & ledger
          const updatedProd = await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });

          await tx.stockEntry.create({
            data: {
              orgId: session.orgId,
              productId: item.productId,
              type: 'SALE_DEDUCT',
              qty: -item.quantity,
              balanceAfter: Math.max(0, updatedProd.stock),
              note: `Sold on Bill ${billNumber}`,
              costPricePaise: item.costPrice,
              createdByUserId: session.sub,
            },
          });
        } else {
          // No recipe mapped: direct product stock deduction
          const updatedProd = await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });

          await tx.stockEntry.create({
            data: {
              orgId: session.orgId,
              productId: item.productId,
              type: 'SALE_DEDUCT',
              qty: -item.quantity,
              balanceAfter: Math.max(0, updatedProd.stock),
              note: `Sold on Bill ${billNumber}`,
              costPricePaise: item.costPrice,
              createdByUserId: session.sub,
            },
          });
        }
      }

      // Loyalty: handle redeem + earn for loyalty customers
      if (customerRecord && loyaltyConfig?.isEnabled) {
        let currentBalance = customerRecord.loyaltyPoints;

        // Redeem first (if requested)
        if ((data.pointsRedeemed ?? 0) > 0 && redemptionDiscount > 0) {
          const redeemPts = Math.min(data.pointsRedeemed ?? 0, currentBalance);
          currentBalance -= redeemPts;
          await tx.customer.update({ where: { id: customerRecord.id }, data: { loyaltyPoints: { decrement: redeemPts } } });
          await tx.loyaltyTransaction.create({
            data: {
              orgId: session.orgId,
              customerId: customerRecord.id,
              saleId: sale.id,
              type: 'REDEEM',
              points: -redeemPts,
              balanceAfter: currentBalance,
              note: `Redeemed on Bill ${sale.billNumber}`,
            },
          });
        }

        // Earn points
        if (pointsToEarn > 0) {
          currentBalance += pointsToEarn;
          await tx.customer.update({ where: { id: customerRecord.id }, data: { loyaltyPoints: { increment: pointsToEarn } } });
          await tx.loyaltyTransaction.create({
            data: {
              orgId: session.orgId,
              customerId: customerRecord.id,
              saleId: sale.id,
              type: 'EARN',
              points: pointsToEarn,
              balanceAfter: currentBalance,
              note: `Earned on Bill ${sale.billNumber}`,
            },
          });
        }
      }

      await writeAuditLog(
        {
          orgId: session.orgId,
          actorUserId: session.sub,
          entity: 'Sale',
          entityId: sale.id,
          action: 'CREATE',
          after: {
            billNumber: sale.billNumber,
            total: sale.total,
            paymentMethod: sale.paymentMethod,
            itemCount: computedItems.length,
            pointsEarned: pointsToEarn,
            pointsRedeemed: data.pointsRedeemed || 0,
          },
        },
        tx
      );

      return sale;
    });

    return created(completedSale);
  } catch (err) {
    console.error('[sales POST checkout]', err);
    return serverError();
  }
}
