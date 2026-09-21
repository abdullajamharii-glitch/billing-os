import { NextRequest } from "next/server";
import { serverError } from "@/lib/api-response";

export async function GET(_request: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return serverError("Not implemented");
}

export async function PATCH(_request: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return serverError("Not implemented");
}

export async function DELETE(_request: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return serverError("Not implemented");
}

export async function POST(_request: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return serverError("Not implemented");
}