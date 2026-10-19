import {
  checkTreasuryBalanceReservation,
  assertTreasuryBalanceReservation,
  TreasuryReservationError,
} from "../src/treasury/reservations";

describe("Treasury Balance Reservation Checks (#693)", () => {
  it("passes when available balance covers reservations, payroll, and minimum reserve", () => {
    const result = checkTreasuryBalanceReservation({
      availableBalance: 10_000n,
      upcomingPayroll: 6_000n,
      minimumReserve: 1_000n,
      reservations: [
        { reservationId: "res-1", amount: 2_000n },
        { reservationId: "res-2", amount: 500n },
      ],
    });

    expect(result.sufficient).toBe(true);
    expect(result.totalReserved).toBe(2_500n);
    expect(result.requiredTotal).toBe(9_500n);
    expect(result.unreservedBalance).toBe(7_500n);
    expect(result.remainingAfterPayroll).toBe(1_500n);
    expect(result.shortfall).toBe(0n);
    expect(result.issues).toEqual([]);
  });

  it("detects shortfall when unreserved balance is insufficient", () => {
    const result = checkTreasuryBalanceReservation({
      availableBalance: 5_000n,
      upcomingPayroll: 4_000n,
      minimumReserve: 500n,
      reservations: [{ reservationId: "res-bonus", amount: 1_000n }],
    });

    expect(result.sufficient).toBe(false);
    expect(result.totalReserved).toBe(1_000n);
    expect(result.requiredTotal).toBe(5_500n);
    expect(result.shortfall).toBe(500n);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "INSUFFICIENT_UNRESERVED_BALANCE",
      }),
    ]);
  });

  it("reports empty and duplicate reservation IDs", () => {
    const result = checkTreasuryBalanceReservation({
      availableBalance: 10_000n,
      upcomingPayroll: 1_000n,
      reservations: [
        { reservationId: "  ", amount: 100n },
        { reservationId: "res-dup", amount: 200n },
        { reservationId: "res-dup", amount: 300n },
      ],
    });

    expect(result.sufficient).toBe(false);
    expect(result.issues.map((i) => i.code)).toEqual([
      "EMPTY_RESERVATION_ID",
      "DUPLICATE_RESERVATION_ID",
    ]);
  });

  it("rejects negative amounts with RangeError", () => {
    expect(() =>
      checkTreasuryBalanceReservation({
        availableBalance: -100n,
        upcomingPayroll: 500n,
        reservations: [],
      })
    ).toThrow(RangeError);
  });

  it("assertTreasuryBalanceReservation throws TreasuryReservationError on failure", () => {
    expect(() =>
      assertTreasuryBalanceReservation({
        availableBalance: 1_000n,
        upcomingPayroll: 2_000n,
        reservations: [],
      })
    ).toThrow(TreasuryReservationError);
  });
});
