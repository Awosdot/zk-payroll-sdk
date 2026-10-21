/** Resolve payroll employee identifiers to current payout destinations. */

export interface PayrollRecipientInput {
  employeeId: string;
  amount: bigint;
  asset: string;
  metadata?: Record<string, unknown>;
}

export interface ResolvedPayrollRecipient extends PayrollRecipientInput {
  recipient: string;
}

export interface RecipientResolutionFailure {
  employeeId: string;
  code: "EMPTY_EMPLOYEE_ID" | "NOT_FOUND" | "INVALID_RECIPIENT";
}

export interface RecipientResolver {
  resolve(employeeId: string): Promise<string | null | undefined>;
}

export interface RecipientResolutionResult {
  resolved: ResolvedPayrollRecipient[];
  failures: RecipientResolutionFailure[];
}

/**
 * Resolve all recipients before building a proof or submitting a payroll.
 * Resolution is deterministic in input order and never mutates the caller's
 * records. A failed lookup is returned as a typed failure instead of silently
 * producing an unsafe payout instruction.
 */
export async function resolvePayrollRecipients(
  entries: readonly PayrollRecipientInput[],
  resolver: RecipientResolver | ((employeeId: string) => Promise<string | null | undefined>)
): Promise<RecipientResolutionResult> {
  const resolve = typeof resolver === "function" ? resolver : resolver.resolve.bind(resolver);
  const resolved: ResolvedPayrollRecipient[] = [];
  const failures: RecipientResolutionFailure[] = [];
  for (const entry of entries) {
    const employeeId = entry.employeeId.trim();
    if (!employeeId) {
      failures.push({ employeeId: entry.employeeId, code: "EMPTY_EMPLOYEE_ID" });
      continue;
    }
    const recipient = (await resolve(employeeId))?.trim();
    if (!recipient) {
      failures.push({ employeeId, code: "NOT_FOUND" });
      continue;
    }
    if (!/^[GMC][A-Z2-7]{55}$/.test(recipient)) {
      failures.push({ employeeId, code: "INVALID_RECIPIENT" });
      continue;
    }
    resolved.push({ ...entry, employeeId, recipient });
  }
  return { resolved, failures };
}
