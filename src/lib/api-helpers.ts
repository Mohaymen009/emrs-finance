import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
import { FileValidationError } from "@/lib/storage";

/**
 * Centralized error translation so every API route returns consistent,
 * safe error shapes and the correct HTTP status code. Never leak internal
 * error details/stack traces to the client.
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    const status = err.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: err.message }, { status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: err.flatten() },
      { status: 400 }
    );
  }
  if (err instanceof FileValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error("Unhandled API error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Applies the business rule: Complimentary payments always net to zero. */
export function applyComplimentaryRule(params: {
  paymentStatus: "UNPAID" | "PAID" | "COMPLIMENTARY";
  paymentMethod?: string;
  amount: number;
}): number {
  if (
    params.paymentStatus === "COMPLIMENTARY" ||
    params.paymentMethod === "COMPLIMENTARY"
  ) {
    return 0;
  }
  return params.amount;
}
