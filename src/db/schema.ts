import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["ADMIN", "VIEWER"]);
export const divisionCodeEnum = pgEnum("division_code", [
  "AMBULANCE",
  "HOME_HEALTHCARE",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "UNPAID",
  "PAID",
  "COMPLIMENTARY",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "POS",
  "TABBY",
  "BANK_TRANSFER",
  "CASH",
  "STRIPE",
  "COMPLIMENTARY",
]);
export const auditActionEnum = pgEnum("audit_action", [
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "CREATE_INCOME",
  "UPDATE_INCOME",
  "DELETE_INCOME",
  "CREATE_EXPENSE",
  "UPDATE_EXPENSE",
  "DELETE_EXPENSE",
  "PAYMENT_RECORDED",
  "FILE_UPLOAD",
  "FILE_DOWNLOAD",
  "EXPORT_REPORT",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DEACTIVATED",
  "USER_DELETED",
  "DIVISION_ACCESS_CHANGED",
]);
export const exportTypeEnum = pgEnum("export_type", [
  "INCOME",
  "EXPENSE",
  "VAT",
  "PROFIT",
]);

// ---------------------------------------------------------------------------
// USERS & ACCESS CONTROL
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  // Always stored lowercase — usernames are case-insensitive.
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: roleEnum("role").notNull().default("VIEWER"),
  isActive: boolean("is_active").notNull().default(true),
  // Who created this account (the master admin, or another admin). Null only
  // for the initial seeded master admin, which has no creator.
  createdById: text("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const divisions = pgTable("divisions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  code: divisionCodeEnum("code").notNull().unique(),
  name: text("name").notNull(),
});

export const userDivisionAccess = pgTable(
  "user_division_access",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    divisionId: text("division_id").notNull().references(() => divisions.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uda_user_division_unique").on(t.userId, t.divisionId)]
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  sessionToken: text("session_token").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// ---------------------------------------------------------------------------
// CLIENTS (optional, per income record)
// ---------------------------------------------------------------------------

export const clients = pgTable("clients", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  companyName: text("company_name"),
  trnNumber: text("trn_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// INCOME (flexible ledger)
// ---------------------------------------------------------------------------

export const incomeRecords = pgTable(
  "income_records",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    divisionId: text("division_id").notNull().references(() => divisions.id),
    title: text("title").notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    vatEnabled: boolean("vat_enabled").notNull().default(false),
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("UNPAID"),
    hasClientDetails: boolean("has_client_details").notNull().default(false),
    clientId: text("client_id").references(() => clients.id),
    notes: text("notes"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("income_division_idx").on(t.divisionId),
    index("income_date_idx").on(t.date),
    index("income_status_idx").on(t.paymentStatus),
  ]
);

// ---------------------------------------------------------------------------
// EXPENSES (flexible ledger)
// ---------------------------------------------------------------------------

export const expenseRecords = pgTable(
  "expense_records",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    divisionId: text("division_id").notNull().references(() => divisions.id),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    supplierName: text("supplier_name"),
    vatEnabled: boolean("vat_enabled").notNull().default(false),
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }),
    notes: text("notes"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("expense_division_idx").on(t.divisionId),
    index("expense_date_idx").on(t.date),
  ]
);

// ---------------------------------------------------------------------------
// FILES: invoices (income) & receipts (expense) — private storage refs only
// ---------------------------------------------------------------------------

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  incomeRecordId: text("income_record_id").notNull().references(() => incomeRecords.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const receipts = pgTable("receipts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  expenseRecordId: text("expense_record_id").notNull().references(() => expenseRecords.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// PAYMENTS (immutable once recorded)
// ---------------------------------------------------------------------------

export const payments = pgTable("payments", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  incomeRecordId: text("income_record_id").notNull().unique().references(() => incomeRecords.id),
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  recordedById: text("recorded_by_id").references(() => users.id, { onDelete: "set null" }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// AUDIT / LOGIN / EXPORT LOGS (immutable, append-only)
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    action: auditActionEnum("action").notNull(),
    recordId: text("record_id"),
    divisionId: text("division_id").references(() => divisions.id),
    metadata: jsonb("metadata"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_user_idx").on(t.userId),
    index("audit_action_idx").on(t.action),
    index("audit_timestamp_idx").on(t.timestamp),
  ]
);

export const loginLogs = pgTable(
  "login_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    // Nullable: a failed login against a username that doesn't exist has no
    // user to attribute to, but we still want it visible to admins as a
    // security event (attemptedUsername captures what was typed).
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    attemptedUsername: text("attempted_username"),
    event: text("event").notNull(), // LOGIN_SUCCESS | LOGIN_FAILED | LOGOUT
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_user_idx").on(t.userId), index("login_timestamp_idx").on(t.timestamp)]
);

export const exportLogs = pgTable(
  "export_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    exportType: exportTypeEnum("export_type").notNull(),
    filters: jsonb("filters").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("export_user_idx").on(t.userId), index("export_timestamp_idx").on(t.timestamp)]
);

// ---------------------------------------------------------------------------
// RELATIONS
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  divisionAccess: many(userDivisionAccess),
  sessions: many(sessions),
}));

export const divisionsRelations = relations(divisions, ({ many }) => ({
  userAccess: many(userDivisionAccess),
  incomeRecords: many(incomeRecords),
  expenseRecords: many(expenseRecords),
}));

export const incomeRelations = relations(incomeRecords, ({ one, many }) => ({
  division: one(divisions, { fields: [incomeRecords.divisionId], references: [divisions.id] }),
  client: one(clients, { fields: [incomeRecords.clientId], references: [clients.id] }),
  createdBy: one(users, { fields: [incomeRecords.createdById], references: [users.id] }),
  invoices: many(invoices),
  payment: one(payments, { fields: [incomeRecords.id], references: [payments.incomeRecordId] }),
}));

export const expenseRelations = relations(expenseRecords, ({ one, many }) => ({
  division: one(divisions, { fields: [expenseRecords.divisionId], references: [divisions.id] }),
  createdBy: one(users, { fields: [expenseRecords.createdById], references: [users.id] }),
  receipts: many(receipts),
}));
