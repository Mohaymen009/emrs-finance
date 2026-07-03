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
  // Postgres foreign-key violation (23503) — most commonly hit here when the
  // DB schema hasn't been migrated yet (see DEPLOY.md: `drizzle-kit push`
  // must be re-run after any schema.ts change) so an old NOT NULL/NO ACTION
  // constraint is still in place. Surface a clear, actionable message
  // instead of a bare 500.
  if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23503") {
    return NextResponse.json(
      {
        error:
          "This action is blocked by a database constraint. If this just started happening after a deploy, the database schema may not have been migrated yet (run `drizzle-kit push` / the `migrate` step).",
      },
      { status: 409 }
    );
  }
  console.error("Unhandled API error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * Standard bookkeeping order for income: gross (amount charged for the
 * service) minus discount = net (the taxable base stored in amount; VAT is
 * calculated on it). The deducted AED value is stored explicitly so the
 * gross is always recoverable as net + discountAmount, with no rounding
 * ambiguity for percentage discounts. A discount can never exceed the gross.
 */
export function applyDiscount(params: {
  grossAmount: number;
  discountType?: "FIXED" | "PERCENT";
  discountValue?: number;
}): { netAmount: number; discountAmount: number | null } {
  const { grossAmount, discountType, discountValue } = params;
  if (!discountType || !discountValue || grossAmount <= 0) {
    return { netAmount: grossAmount, discountAmount: null };
  }
  const raw = discountType === "PERCENT" ? (grossAmount * discountValue) / 100 : discountValue;
  const discountAmount = Math.min(Number(raw.toFixed(2)), grossAmount);
  return { netAmount: Number((grossAmount - discountAmount).toFixed(2)), discountAmount };
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
