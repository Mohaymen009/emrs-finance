import { z } from "zod";

export const divisionCodeSchema = z.enum(["AMBULANCE", "HOME_HEALTHCARE"]);

export const clientDetailsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  companyName: z.string().trim().optional(),
  trnNumber: z.string().trim().optional(),
});

export const createIncomeSchema = z
  .object({
    divisionCode: divisionCodeSchema,
    title: z.string().trim().min(1, "Title / description is required"),
    date: z.coerce.date(),
    amount: z.coerce.number().nonnegative(),
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
  })
  .superRefine((data, ctx) => {
    if (data.paymentStatus === "PAID") {
      if (!data.paymentDate) {
        ctx.addIssue({ code: "custom", message: "Payment date is required when status is Paid", path: ["paymentDate"] });
      }
      if (!data.paymentMethod) {
        ctx.addIssue({ code: "custom", message: "Payment method is required when status is Paid", path: ["paymentMethod"] });
      }
    }
    if (data.vatEnabled && data.vatAmount === undefined) {
      ctx.addIssue({ code: "custom", message: "VAT amount is required when VAT is enabled", path: ["vatAmount"] });
    }
  });

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;

// Edit never touches paymentStatus/paymentDate/paymentMethod — payment
// history is permanent/immutable once recorded (see src/app/api/income/route.ts).
export const updateIncomeSchema = z.object({
  divisionCode: divisionCodeSchema.optional(),
  title: z.string().trim().min(1).optional(),
  date: z.coerce.date().optional(),
  amount: z.coerce.number().nonnegative().optional(),
  vatEnabled: z.boolean().optional(),
  vatAmount: z.coerce.number().nonnegative().optional(),
  hasClientDetails: z.boolean().optional(),
  client: clientDetailsSchema.optional(),
  notes: z.string().trim().optional(),
});

export const createExpenseSchema = z.object({
  divisionCode: divisionCodeSchema,
  description: z.string().trim().min(1, "Expense description is required"),
  amount: z.coerce.number().positive(),
  date: z.coerce.date(),
  supplierName: z.string().trim().optional(),
  vatEnabled: z.boolean().default(false),
  vatAmount: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  divisionCode: divisionCodeSchema.optional(),
  description: z.string().trim().min(1).optional(),
  date: z.coerce.date().optional(),
  amount: z.coerce.number().positive().optional(),
  supplierName: z.string().trim().optional(),
  vatEnabled: z.boolean().optional(),
  vatAmount: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().optional(),
});

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
  role: z.enum(["ADMIN", "VIEWER"]),
  divisionCodes: z.array(divisionCodeSchema).default([]),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  role: z.enum(["ADMIN", "VIEWER"]).optional(),
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
