import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api-response";
import { validateBody } from "@/lib/validate";

const UpdateConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  pointsPerHundred: z.number().int().min(0).max(100).optional(),
  pointValuePaise: z.number().int().min(1).optional(),
  minPointsRedeem: z.number().int().min(0).optional(),
  expiryDays: z.number().int().min(0).optional(),
  silverThreshold: z.number().int().min(1).optional(),
  goldThreshold: z.number().int().min(1).optional(),
  platinumThreshold: z.number().int().min(1).optional(),
});

async function getOrCreateConfig(orgId: string) {
  let config = await prisma.loyaltyConfig.findUnique({ where: { orgId } });
  if (!config) {
    config = await prisma.loyaltyConfig.create({ data: { orgId } });
  }
  return config;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const config = await getOrCreateConfig(session.orgId);
    return ok(config);
  } catch (err) {
    console.error("[loyalty/config GET]", err);
    return serverError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!["OWNER", "ADMIN"].includes(session.role)) return forbidden();

    const body = await request.json();
    const { data, error } = validateBody(UpdateConfigSchema, body);
    if (error) return error;

    const config = await prisma.loyaltyConfig.upsert({
      where: { orgId: session.orgId },
      create: { orgId: session.orgId, ...data },
      update: data,
    });

    return ok(config);
  } catch (err) {
    console.error("[loyalty/config PATCH]", err);
    return serverError();
  }
}
