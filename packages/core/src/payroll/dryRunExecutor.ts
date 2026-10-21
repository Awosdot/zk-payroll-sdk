/** Side-effect-free payroll execution preview. */

import type { PayrollRecipientInput } from "./recipientResolver";

export interface DryRunIssue {
  code: "EMPTY_BATCH" | "INVALID_AMOUNT" | "INVALID_ASSET" | "DUPLICATE_EMPLOYEE";
  employeeId?: string;
  message: string;
}

export interface PayrollDryRunResult {
  wouldSubmit: boolean;
  totalAmount: bigint;
  recipientCount: number;
  estimatedFee?: bigint;
  issues: DryRunIssue[];
}

export interface PayrollDryRunOptions {
  estimateFee?: (entries: readonly PayrollRecipientInput[]) => Promise<bigint>;
}

/** Validate and account for a payroll without signing, proving, or submitting it. */
export async function executePayrollDryRun(
  entries: readonly PayrollRecipientInput[],
  options: PayrollDryRunOptions = {}
): Promise<PayrollDryRunResult> {
  const issues: DryRunIssue[] = [];
  if (entries.length === 0)
    issues.push({ code: "EMPTY_BATCH", message: "Payroll batch cannot be empty." });
  const seen = new Set<string>();
  let totalAmount = 0n;
  for (const entry of entries) {
    if (seen.has(entry.employeeId))
      issues.push({
        code: "DUPLICATE_EMPLOYEE",
        employeeId: entry.employeeId,
        message: "Employee appears more than once.",
      });
    seen.add(entry.employeeId);
    if (entry.amount <= 0n)
      issues.push({
        code: "INVALID_AMOUNT",
        employeeId: entry.employeeId,
        message: "Amount must be positive.",
      });
    if (!entry.asset.trim())
      issues.push({
        code: "INVALID_ASSET",
        employeeId: entry.employeeId,
        message: "Asset is required.",
      });
    totalAmount += entry.amount;
  }
  const estimatedFee =
    issues.length === 0 && options.estimateFee ? await options.estimateFee(entries) : undefined;
  return {
    wouldSubmit: issues.length === 0,
    totalAmount,
    recipientCount: entries.length,
    estimatedFee,
    issues,
  };
}
