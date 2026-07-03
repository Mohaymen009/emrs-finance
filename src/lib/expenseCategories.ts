// Preset expense categories shown in the Expenses form dropdown. "Other" in
// the UI falls back to a free-text value, which is stored as-is in
// expenseRecords.category — so this list can grow over time without a
// migration; it's just what's offered as a shortcut.
export const EXPENSE_CATEGORIES = [
  "Uniforms",
  "Fuel",
  "Mechanical Repairs",
  "Salaries",
  "Salary Advance",
  "Stationary",
  "DEWA",
  "Rent",
  "Furniture",
  "Equipment",
  "Training",
  "Licensing",
  "Operational Expenses",
  "Visa/Work Permit",
  "Medical Insurance",
  "Malpractice Insurance",
  "Commission",
] as const;
