import { z } from "zod";

export const divisionCodeSchema = z.enum(["AMBULANCE", "HOME_HEALTHCARE"]);

export const clientDetailsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  companyName: z.string().trim().optional(),
  trnNumber: z.string().trim().optional(),
});

// Optional discount on income: amount is submitted as the gross (pre-
// discount) figure; the API computes the deducted AED value and stores the
// net. PERCENT values are 0-100.
const discountFields = {
  discountType: z.enum(["FIXED", "PERCENT"]).optional(),
  discountValue: z.coerce.number().nonnegative().optional(),
};

function validateDiscount(
  data: { discountType?: "FIXED" | "PERCENT"; discountValue?: number },
  ctx: z.RefinementCtx
) {
  if (data.discountType && data.discountValue === undefined) {
    ctx.addIssue({ code: "custom", message: "Discount value is required when a discount type is selected", path: ["discountValue"] });
  }
  if (data.discountType === "PERCENT" && data.discountValue !== undefined && data.discountValue > 100) {
    ctx.addIssue({ code: "custom", message: "Percentage discount cannot exceed 100%", path: ["discountValue"] });
  }
}

export const createIncomeSchema = z
  .object({
    divisionCode: divisionCodeSchema,
    // User-entered reference number — never auto-generated. Uniqueness
    // (among non-deleted income records) is checked in the route itself.
    refNumber: z.string().trim().min(1, "Reference number is required"),
    title: z.string().trim().min(1, "Title / description is required"),
    // Service date — when the service was performed.
    date: z.coerce.date(),
    // Gross amount before discount; the API derives the stored net.
    amount: z.coerce.number().nonnegative(),
    ...discountFields,
    paymentStatus: z.enum(["UNPAID", "PAID", "COMPLIMENTARY"]).default("UNPAID"),
    vatEnabled: z.boolean().default(false),
    vatAmount: z.coerce.number().nonnegative().optional(),
    hasClientDetails: z.boolean().default(false),
    client: clientDetailsSchema.optional(),
    notes: z.string().trim().optional(),
    // required only when paymentStatus === PAID
    paymentDate: z.coerce.date().optional(),
    paymentMethod: z
      .enum(["POS", "TABBY", "BANK_TRANSFER", "CASH", "STRIPE", "COMPLIMENTARY"])
      .optional(),
    // The actual amount that lands after processor fees/deductions — only
    // meaningful (and required) once the record is Paid.
    netReceivedAmount: z.coerce.number().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentStatus === "PAID") {
      if (!data.paymentDate) {
        ctx.addIssue({ code: "custom", message: "Payment date is required when status is Paid", path: ["paymentDate"] });
      }
      if (!data.paymentMethod) {
        ctx.addIssue({ code: "custom", message: "Payment method is required when status is Paid", path: ["paymentMethod"] });
      }
      if (data.netReceivedAmount === undefined) {
        ctx.addIssue({ code: "custom", message: "Net amount received is required when status is Paid", path: ["netReceivedAmount"] });
      }
    }
    if (data.vatEnabled && data.vatAmount === undefined) {
      ctx.addIssue({ code: "custom", message: "VAT amount is required when VAT is enabled", path: ["vatAmount"] });
    }
    validateDiscount(data, ctx);
  });

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;

// Edit never touches paymentStatus/paymentDate/paymentMethod — payment
// history is permanent/immutable once recorded (see src/app/api/income/route.ts).
export const updateIncomeSchema = z
  .object({
    divisionCode: divisionCodeSchema.optional(),
    refNumber: z.string().trim().min(1, "Reference number is required").optional(),
    title: z.string().trim().min(1).optional(),
    date: z.coerce.date().optional(),
    // Gross amount before discount, like createIncomeSchema.
    amount: z.coerce.number().nonnegative().optional(),
    ...discountFields,
    vatEnabled: z.boolean().optional(),
    vatAmount: z.coerce.number().nonnegative().optional(),
    hasClientDetails: z.boolean().optional(),
    client: clientDetailsSchema.optional(),
    notes: z.string().trim().optional(),
  })
  .superRefine(validateDiscount);

export const createExpenseSchema = z.object({
  divisionCode: divisionCodeSchema,
  // User-entered reference number — never auto-generated. Uniqueness
  // (among non-deleted expense records) is checked in the route itself.
  refNumber: z.string().trim().min(1, "Reference number is required"),
  description: z.string().trim().min(1, "Expense description is required"),
  category: z.string().trim().min(1, "Category is required"),
  amount: z.coerce.number().positive(),
  // Purchase/service date — when we bought the item or received the service.
  date: z.coerce.date(),
  // When we actually paid for it; optional (an expense may not be paid yet).
  paymentDate: z.coerce.date().optional(),
  supplierName: z.string().trim().optional(),
  vatEnabled: z.boolean().default(false),
  vatAmount: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  divisionCode: divisionCodeSchema.optional(),
  refNumber: z.string().trim().min(1, "Reference number is required").optional(),
  description: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  date: z.coerce.date().optional(),
  // null clears a previously set payment date.
  paymentDate: z.coerce.date().nullable().optional(),
  amount: z.coerce.number().positive().optional(),
  supplierName: z.string().trim().optional(),
  vatEnabled: z.boolean().optional(),
  vatAmount: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().optional(),
});

// Standalone client create/edit from the Clients (CRM) pages. Empty strings
// are normalized to undefined so clearing a field in the edit form stores
// NULL rather than "". At least one of name/company is required — a client
// row with no identifying name at all is unusable in every list/lookup.
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const clientUpsertSchema = z
  .object({
    name: optionalText,
    phone: optionalText,
    email: z.string().trim().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
    companyName: optionalText,
    trnNumber: optionalText,
    address: optionalText,
    notes: optionalText,
  })
  .refine((data) => data.name || data.companyName, {
    message: "A client name or company name is required",
    path: ["name"],
  });

export type ClientUpsertInput = z.infer<typeof clientUpsertSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

// Minimum bar for account passwords. Kept deliberately simple (no special-
// character requirement) since usernames/passwords are case-insensitive by
// design here — length + a mix of letters and numbers is what we can still
// enforce, combined with the login rate limiter/lockout.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores and hyphens");

export const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1, "Full name is required"),
  role: z.enum(["ADMIN", "VIEWER", "DISPATCHER"]),
  divisionCodes: z.array(divisionCodeSchema).default([]),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  role: z.enum(["ADMIN", "VIEWER", "DISPATCHER"]).optional(),
  isActive: z.boolean().optional(),
  divisionCodes: z.array(divisionCodeSchema).optional(),
  newPassword: passwordSchema.optional(),
});

export const exportFiltersSchema = z.object({
  divisionCode: divisionCodeSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  paymentStatus: z.enum(["UNPAID", "PAID", "COMPLIMENTARY"]).optional(),
  vatOnly: z.boolean().optional(),
});

// Admin approve/deny action on a Dispatcher's edit-access request.
export const editRequestActionSchema = z.object({
  action: z.enum(["APPROVE", "DENY"]),
});
