import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";

const RecipeItemSchema = z.object({
  ingredientId: z.string().min(1, "Ingredient ID is required"),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unit: z.string().default("pcs"),
  notes: z.string().optional().nullable(),
});

const SaveRecipeSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  items: z.array(RecipeItemSchema),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (productId) {
      const items = await prisma.recipeItem.findMany({
        where: { orgId: session.orgId, productId },
        include: {
          ingredient: {
            select: {
              id: true,
              name: true,
              unit: true,
              costPrice: true,
              stock: true,
              minStock: true,
              barcode: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      let totalCostPaise = 0;
      for (const it of items) {
        totalCostPaise += Math.round((it.ingredient.costPrice || 0) * it.quantity);
      }

      return ok({ items, totalCostPaise });
    }

    const recipeItems = await prisma.recipeItem.findMany({
      where: { orgId: session.orgId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            costPrice: true,
            unit: true,
            stock: true,
            category: { select: { name: true, color: true } },
          },
        },
        ingredient: {
          select: {
            id: true,
            name: true,
            unit: true,
            costPrice: true,
            stock: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const grouped = new Map<
      string,
      {
        product: (typeof recipeItems)[0]["product"];
        items: Array<{
          id: string;
          ingredientId: string;
          ingredient: (typeof recipeItems)[0]["ingredient"];
          quantity: number;
          unit: string;
          notes: string | null;
        }>;
        totalCostPaise: number;
      }
    >();

    for (const r of recipeItems) {
      let entry = grouped.get(r.productId);
      if (!entry) {
        entry = {
          product: r.product,
          items: [],
          totalCostPaise: 0,
        };
        grouped.set(r.productId, entry);
      }

      const lineCost = Math.round((r.ingredient.costPrice || 0) * r.quantity);
      entry.totalCostPaise += lineCost;

      entry.items.push({
        id: r.id,
        ingredientId: r.ingredientId,
        ingredient: r.ingredient,
        quantity: r.quantity,
        unit: r.unit,
        notes: r.notes,
      });
    }

    return ok(Array.from(grouped.values()));
  } catch (err) {
    console.error("[recipes GET]", err);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(session.role)) return forbidden();

    const body = await request.json();
    const parsed = SaveRecipeSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const { productId, items } = parsed.data;

    const product = await prisma.product.findFirst({
      where: { id: productId, orgId: session.orgId },
    });
    if (!product) return badRequest("Menu product not found");

    const saved = await prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({
        where: { orgId: session.orgId, productId },
      });

      if (items.length > 0) {
        await tx.recipeItem.createMany({
          data: items.map((it) => ({
            orgId: session.orgId,
            productId,
            ingredientId: it.ingredientId,
            quantity: it.quantity,
            unit: it.unit || "pcs",
            notes: it.notes || null,
          })),
        });
      }

      const updatedRecipe = await tx.recipeItem.findMany({
        where: { orgId: session.orgId, productId },
        include: {
          ingredient: {
            select: { id: true, name: true, costPrice: true, unit: true, stock: true },
          },
        },
      });

      let calculatedCostPaise = 0;
      for (const r of updatedRecipe) {
        calculatedCostPaise += Math.round((r.ingredient.costPrice || 0) * r.quantity);
      }

      if (calculatedCostPaise > 0) {
        await tx.product.update({
          where: { id: productId },
          data: { costPrice: calculatedCostPaise },
        });
      }

      return { items: updatedRecipe, calculatedCostPaise };
    });

    return created(saved);
  } catch (err) {
    console.error("[recipes POST]", err);
    return serverError();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!["OWNER", "ADMIN"].includes(session.role)) return forbidden();

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    if (!productId) return badRequest("productId is required");

    await prisma.recipeItem.deleteMany({
      where: { orgId: session.orgId, productId },
    });

    return ok({ message: "Recipe deleted successfully" });
  } catch (err) {
    console.error("[recipes DELETE]", err);
    return serverError();
  }
}