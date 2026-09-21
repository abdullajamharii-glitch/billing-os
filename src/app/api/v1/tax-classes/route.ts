import { NextRequest } from "next/server";
import { serverError } from "@/lib/api-response";

export async function GET(_request: NextRequest) {
  return serverError("Not implemented");
}

export async function POST(_request: NextRequest) {
  return serverError("Not implemented");
}