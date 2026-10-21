/** Detect anomalous differences between expected and observed payout amounts. */

export interface PayoutAmount {
  employeeId: string;
  amount: bigint;
  asset: string;
}
export interface PayoutVarianceOptions {
  absoluteTolerance?: bigint;
  relativeToleranceBps?: number;
}
export interface PayoutAnomaly {
  employeeId: string;
  asset: string;
  expected: bigint;
  actual?: bigint;
  delta: bigint;
  reason: "MISSING" | "UNEXPECTED" | "OUTSIDE_TOLERANCE";
}
export interface PayoutVarianceReport {
  anomalies: PayoutAnomaly[];
  expectedTotal: bigint;
  actualTotal: bigint;
  isAnomalous: boolean;
}

export function detectPayoutVariance(
  expected: readonly PayoutAmount[],
  actual: readonly PayoutAmount[],
  options: PayoutVarianceOptions = {}
): PayoutVarianceReport {
  const absoluteTolerance = options.absoluteTolerance ?? 0n;
  const relativeToleranceBps = options.relativeToleranceBps ?? 0;
  if (!Number.isInteger(relativeToleranceBps) || relativeToleranceBps < 0)
    throw new Error("relativeToleranceBps must be a non-negative integer");
  const expectedByKey = new Map(expected.map((item) => [`${item.employeeId}:${item.asset}`, item]));
  const actualByKey = new Map(actual.map((item) => [`${item.employeeId}:${item.asset}`, item]));
  const anomalies: PayoutAnomaly[] = [];
  for (const [key, item] of expectedByKey) {
    const observed = actualByKey.get(key);
    if (!observed) {
      anomalies.push({
        employeeId: item.employeeId,
        asset: item.asset,
        expected: item.amount,
        delta: -item.amount,
        reason: "MISSING",
      });
      continue;
    }
    const delta = observed.amount - item.amount;
    const relativeLimit = (item.amount * BigInt(relativeToleranceBps)) / 10_000n;
    const tolerance = relativeLimit > absoluteTolerance ? relativeLimit : absoluteTolerance;
    if (delta < -tolerance || delta > tolerance) {
      anomalies.push({
        employeeId: item.employeeId,
        asset: item.asset,
        expected: item.amount,
        actual: observed.amount,
        delta,
        reason: "OUTSIDE_TOLERANCE",
      });
    }
  }
  for (const [key, item] of actualByKey)
    if (!expectedByKey.has(key))
      anomalies.push({
        employeeId: item.employeeId,
        asset: item.asset,
        expected: 0n,
        actual: item.amount,
        delta: item.amount,
        reason: "UNEXPECTED",
      });
  return {
    anomalies,
    expectedTotal: expected.reduce((sum, item) => sum + item.amount, 0n),
    actualTotal: actual.reduce((sum, item) => sum + item.amount, 0n),
    isAnomalous: anomalies.length > 0,
  };
}
