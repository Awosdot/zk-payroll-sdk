import {
  confirmEmployeeDestination,
  confirmEmployeeDestinations,
  assertEmployeeDestinationsConfirmed,
  DestinationConfirmationError,
} from "../src/employees/destinationConfirmation";

describe("Employee Payment Destination Confirmation (#698)", () => {
  const VALID_ADDR_1 = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA";
  const VALID_ADDR_2 = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
  const INVALID_ADDR = "GINVALIDNOT56CHARS";

  it("confirms a valid destination when expected and proposed match", () => {
    const result = confirmEmployeeDestination({
      employeeId: "emp-1",
      expectedAddress: VALID_ADDR_1,
      proposedAddress: VALID_ADDR_1,
    });

    expect(result.status).toBe("confirmed");
    expect(result.confirmedAddress).toBe(VALID_ADDR_1);
    expect(result.issues).toEqual([]);
  });

  it("detects address mismatch between expected and proposed destination", () => {
    const result = confirmEmployeeDestination({
      employeeId: "emp-1",
      expectedAddress: VALID_ADDR_1,
      proposedAddress: VALID_ADDR_2,
    });

    expect(result.status).toBe("mismatch");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "DESTINATION_MISMATCH",
      }),
    ]);
  });

  it("detects invalid Stellar address formats", () => {
    const result = confirmEmployeeDestination({
      employeeId: "emp-1",
      expectedAddress: INVALID_ADDR,
    });

    expect(result.status).toBe("invalid");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "INVALID_EXPECTED_ADDRESS",
      }),
    ]);
  });

  it("detects unverified status when requireVerified is enabled", () => {
    const result = confirmEmployeeDestination(
      {
        employeeId: "emp-1",
        expectedAddress: VALID_ADDR_1,
        isVerified: false,
      },
      { requireVerified: true }
    );

    expect(result.status).toBe("unconfirmed");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "DESTINATION_UNVERIFIED",
      }),
    ]);
  });

  it("confirms batch destinations and assert throws on failure", () => {
    const batch = confirmEmployeeDestinations({
      destinations: [
        { employeeId: "emp-1", expectedAddress: VALID_ADDR_1 },
        { employeeId: "emp-2", expectedAddress: VALID_ADDR_2 },
      ],
    });

    expect(batch.allConfirmed).toBe(true);
    expect(batch.confirmedCount).toBe(2);

    expect(() =>
      assertEmployeeDestinationsConfirmed({
        destinations: [{ employeeId: "emp-1", expectedAddress: INVALID_ADDR }],
      })
    ).toThrow(DestinationConfirmationError);
  });
});
