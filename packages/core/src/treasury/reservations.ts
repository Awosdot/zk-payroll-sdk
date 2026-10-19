/**
 * Treasury Balance Reservation Checks (#693).
 *
 * Implements pure SDK-layer validation and management for reserving treasury funds
 * across pending and executing payroll disbursements, preventing overallocation
 * and ensuring required liquidity reserves are honored.
 */

export interface TreasuryReservationItem {
  readonly reservationId: string;
  readonly amount: bigint;
  readonly asset?: string;
  readonly description?: string;
  readonly createdAt?: number;
}

export interface TreasuryBalanceReservationInput {
  /** Available raw treasury balance before any active reservations */
  readonly availableBalance: bigint;
  /** Active or proposed reservations to lock against the treasury */
  readonly reservations: readonly TreasuryReservationItem[];
  /** Amount needed for upcoming payroll execution */
  readonly upcomingPayroll: bigint;
  /** Mandatory minimum unreserved liquidity buffer (default: 0n) */
  readonly minimumReserve?: bigint;
}

export interface TreasuryReservationIssue {
  readonly code:
    | "EMPTY_RESERVATION_ID"
    | "DUPLICATE_RESERVATION_ID"
    | "NEGATIVE_AMOUNT"
    | "INSUFFICIENT_UNRESERVED_BALANCE";
  readonly message: string;
  readonly path?: string;
}

export interface TreasuryBalanceReservationResult {
  readonly sufficient: boolean;
  readonly totalReserved: bigint;
  readonly requiredTotal: bigint;
  readonly unreservedBalance: bigint;
  readonly remainingAfterPayroll: bigint;
  readonly shortfall: bigint;
  readonly issues: readonly TreasuryReservationIssue[];
}

export class TreasuryReservationError extends Error {
  readonly code = "TREASURY_RESERVATION_FAILED";
  readonly issues: readonly TreasuryReservationIssue[];

  constructor(message: string, issues: readonly TreasuryReservationIssue[]) {
    super(message);
    this.name = "TreasuryReservationError";
    this.issues = issues;
  }
}

/**
 * Validates and checks treasury balance reservations against upcoming payroll obligations.
 */
export function checkTreasuryBalanceReservation(
  input: TreasuryBalanceReservationInput
): TreasuryBalanceReservationResult {
  const issues: TreasuryReservationIssue[] = [];
  const minimumReserve = input.minimumReserve ?? 0n;

  if (input.availableBalance < 0n || input.upcomingPayroll < 0n || minimumReserve < 0n) {
    throw new RangeError(
      "Treasury available balance, upcoming payroll, and minimum reserve must be non-negative"
    );
  }

  const seenIds = new Set<string>();
  let totalReserved = 0n;

  input.reservations.forEach((item, index) => {
    const path = `reservations[${index}]`;
    if (!item.reservationId || !item.reservationId.trim()) {
      issues.push({
        code: "EMPTY_RESERVATION_ID",
        message: "Reservation ID must not be empty",
        path: `${path}.reservationId`,
      });
    } else if (seenIds.has(item.reservationId.trim())) {
      issues.push({
        code: "DUPLICATE_RESERVATION_ID",
        message: `Duplicate reservation ID: ${item.reservationId.trim()}`,
        path: `${path}.reservationId`,
      });
    } else {
      seenIds.add(item.reservationId.trim());
    }

    if (item.amount < 0n) {
      issues.push({
        code: "NEGATIVE_AMOUNT",
        message: `Reservation amount must be non-negative at ${path}`,
        path: `${path}.amount`,
      });
    } else {
      totalReserved += item.amount;
    }
  });

  const requiredTotal = totalReserved + input.upcomingPayroll + minimumReserve;
  const shortfall =
    input.availableBalance >= requiredTotal ? 0n : requiredTotal - input.availableBalance;
  const unreservedBalance =
    input.availableBalance >= totalReserved ? input.availableBalance - totalReserved : 0n;
  const remainingAfterPayroll =
    input.availableBalance >= totalReserved + input.upcomingPayroll
      ? input.availableBalance - totalReserved - input.upcomingPayroll
      : 0n;

  if (shortfall > 0n) {
    issues.push({
      code: "INSUFFICIENT_UNRESERVED_BALANCE",
      message: `Treasury balance is insufficient: available ${input.availableBalance}, required ${requiredTotal} (shortfall: ${shortfall})`,
    });
  }

  return {
    sufficient: issues.length === 0,
    totalReserved,
    requiredTotal,
    unreservedBalance,
    remainingAfterPayroll,
    shortfall,
    issues,
  };
}

/**
 * Asserts that the treasury balance can satisfy all reservations and payroll, throwing if not.
 */
export function assertTreasuryBalanceReservation(
  input: TreasuryBalanceReservationInput
): TreasuryBalanceReservationResult {
  const result = checkTreasuryBalanceReservation(input);
  if (!result.sufficient) {
    throw new TreasuryReservationError(
      `Treasury reservation check failed with ${result.issues.length} issue(s)`,
      result.issues
    );
  }
  return result;
}
