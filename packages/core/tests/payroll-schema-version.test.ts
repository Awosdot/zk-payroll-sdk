/**
 * Payroll payload schema version detector tests: current, legacy, and
 * unsupported payloads, deprecation warnings, and typed failures.
 */

import {
  CURRENT_PAYROLL_SCHEMA_VERSION,
  DEPRECATED_PAYROLL_SCHEMA_VERSIONS,
  LEGACY_PAYROLL_SCHEMA_VERSION,
  PAYROLL_SCHEMA_VERSION,
  SUPPORTED_PAYROLL_SCHEMA_VERSIONS,
  detectPayrollSchemaVersion,
  isDeprecatedPayrollSchemaVersion,
  isSupportedPayrollSchemaVersion,
  InvalidPayrollSchemaPayloadError,
  PayrollSchemaErrorCode,
  UnsupportedPayrollSchemaVersionError,
} from "../src/schema";
import {
  PAYROLL_FIELD_DEPRECATIONS,
  collectPayrollFieldDeprecationWarnings,
  findDeprecatedPayrollFields,
  migratePayrollPayload,
} from "../src/migrations";
import { detectPayrollPayloadSchema } from "../src/payroll/payloadSchema";
import { ZkPayrollError } from "../src/core/errors";
import { ERROR_CODE_REGISTRY, isRetryableErrorCode } from "../src/core/error-codes";

const CURRENT_PAYLOAD = {
  schemaVersion: "1.0",
  entries: [{ recipient: "GABC", amount: 1000, asset: "native", employeeId: "emp-1" }],
  idempotencyKeys: ["key-1"],
};

const LEGACY_PAYLOAD = {
  schemaVersion: "0.9",
  payments: [{ recipient: "GABC" }],
  walletAddress: "GABC",
  salary: 1000,
  token: "native",
  employee: "emp-1",
};

/** Runs a function and returns the thrown value, or `undefined` if none. */
function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("supported payroll schema versions", () => {
  it("exposes the current and legacy supported versions", () => {
    expect(PAYROLL_SCHEMA_VERSION).toEqual({ V0_9: "0.9", V1_0: "1.0" });
    expect(CURRENT_PAYROLL_SCHEMA_VERSION).toBe("1.0");
    expect(LEGACY_PAYROLL_SCHEMA_VERSION).toBe("0.9");
    expect(SUPPORTED_PAYROLL_SCHEMA_VERSIONS).toEqual(["0.9", "1.0"]);
    expect(DEPRECATED_PAYROLL_SCHEMA_VERSIONS).toEqual(["0.9"]);
  });

  it("classifies supported, deprecated, and unsupported versions", () => {
    expect(isSupportedPayrollSchemaVersion("1.0")).toBe(true);
    expect(isSupportedPayrollSchemaVersion("0.9")).toBe(true);
    expect(isSupportedPayrollSchemaVersion("2.0")).toBe(false);
    expect(isSupportedPayrollSchemaVersion(undefined)).toBe(false);

    expect(isDeprecatedPayrollSchemaVersion("0.9")).toBe(true);
    expect(isDeprecatedPayrollSchemaVersion("1.0")).toBe(false);
    expect(isDeprecatedPayrollSchemaVersion("2.0")).toBe(false);
  });
});

describe("detectPayrollSchemaVersion - current payloads", () => {
  it("detects an explicit current-version payload with no warnings", () => {
    const result = detectPayrollSchemaVersion(CURRENT_PAYLOAD);

    expect(result.version).toBe("1.0");
    expect(result.source).toBe("explicit");
    expect(result.isDeprecatedVersion).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.deprecatedFields).toEqual([]);
  });

  it("accepts the snake_case schema_version alias", () => {
    const result = detectPayrollSchemaVersion({ schema_version: "1.0", entries: [] });

    expect(result.version).toBe("1.0");
    expect(result.source).toBe("explicit");
  });

  it("infers the current version for a payload without a version field", () => {
    const result = detectPayrollSchemaVersion({ entries: [] });

    expect(result.version).toBe("1.0");
    expect(result.source).toBe("inferred");
    expect(result.warnings).toEqual([]);
  });

  it("still warns about legacy fields on an explicit current-version payload", () => {
    const result = detectPayrollSchemaVersion({ schemaVersion: "1.0", payments: [] });

    expect(result.version).toBe("1.0");
    expect(result.deprecatedFields).toEqual(["payments"]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: "payments",
        replacement: "entries",
        deprecatedInVersion: "0.9",
        message: expect.stringContaining("`entries`"),
      }),
    ]);
  });
});

describe("detectPayrollSchemaVersion - legacy payloads", () => {
  it("detects an explicit legacy version and flags it as deprecated", () => {
    const result = detectPayrollSchemaVersion(LEGACY_PAYLOAD);

    expect(result.version).toBe("0.9");
    expect(result.source).toBe("explicit");
    expect(result.isDeprecatedVersion).toBe(true);
    expect(result.warnings[0]).toEqual(
      expect.objectContaining({
        field: "schemaVersion",
        replacement: "1.0",
        message: expect.stringContaining("deprecated"),
      })
    );
  });

  it("infers the legacy version from legacy field names when no version is declared", () => {
    const result = detectPayrollSchemaVersion({
      payments: [{ walletAddress: "GABC" }],
      salary: 1000,
    });

    expect(result.version).toBe("0.9");
    expect(result.source).toBe("inferred");
    expect(result.isDeprecatedVersion).toBe(true);
    expect(result.deprecatedFields).toEqual(["payments", "salary"]);
  });

  it("emits a clear warning per deprecated field, each naming its replacement", () => {
    const result = detectPayrollSchemaVersion(LEGACY_PAYLOAD);

    const byField = new Map(result.warnings.map((w) => [w.field, w]));
    for (const deprecation of Object.values(PAYROLL_FIELD_DEPRECATIONS)) {
      const warning = byField.get(deprecation.field);
      expect(warning).toBeDefined();
      expect(warning?.message).toContain(deprecation.field);
      expect(warning?.message).toContain(deprecation.removeInVersion);
      if (deprecation.replacement) {
        expect(warning?.replacement).toBe(deprecation.replacement);
        expect(warning?.message).toContain(deprecation.replacement);
      }
    }
  });
});

describe("detectPayrollSchemaVersion - unsupported payloads", () => {
  it("throws a typed error for a future schema version", () => {
    expect(() => detectPayrollSchemaVersion({ schemaVersion: "2.0" })).toThrow(
      UnsupportedPayrollSchemaVersionError
    );

    const error = catchError(() => detectPayrollSchemaVersion({ schemaVersion: "2.0" }));
    expect(error).toBeInstanceOf(ZkPayrollError);
    expect(error).toBeInstanceOf(Error);
    const typed = error as UnsupportedPayrollSchemaVersionError;
    expect(typed.name).toBe("UnsupportedPayrollSchemaVersionError");
    expect(typed.code).toBe(PayrollSchemaErrorCode.UNSUPPORTED_VERSION);
    expect(typed.code).toBe("PAYROLL_SCHEMA_VERSION_UNSUPPORTED");
    expect(typed.detectedVersion).toBe("2.0");
    expect(typed.supportedVersions).toEqual(["0.9", "1.0"]);
    expect(typed.message).toContain('"2.0"');
    expect(typed.message).toContain("0.9, 1.0");
    expect(isRetryableErrorCode(typed.code)).toBe(false);
  });

  it("throws for an unknown legacy version outside the supported range", () => {
    expect(() => detectPayrollSchemaVersion({ schema_version: "0.5" })).toThrow(
      UnsupportedPayrollSchemaVersionError
    );
  });

  it("throws for non-object payloads", () => {
    for (const payload of [null, undefined, "1.0", 42, ["1.0"]]) {
      let caught: unknown;
      try {
        detectPayrollSchemaVersion(payload);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(InvalidPayrollSchemaPayloadError);
      expect((caught as InvalidPayrollSchemaPayloadError).code).toBe(
        "PAYROLL_SCHEMA_PAYLOAD_INVALID"
      );
    }
  });

  it("rejects a non-string version field", () => {
    const error = catchError(() => detectPayrollSchemaVersion({ schemaVersion: 1 }));
    expect(error).toBeInstanceOf(InvalidPayrollSchemaPayloadError);
    expect((error as InvalidPayrollSchemaPayloadError).field).toBe("schemaVersion");
    expect((error as Error).message).toContain("must be a string");
  });

  it("rejects an empty version field", () => {
    expect(() => detectPayrollSchemaVersion({ schemaVersion: "   " })).toThrow(
      InvalidPayrollSchemaPayloadError
    );
  });

  it("rejects conflicting version fields", () => {
    const error = catchError(() =>
      detectPayrollSchemaVersion({ schemaVersion: "1.0", schema_version: "0.9" })
    );
    expect(error).toBeInstanceOf(InvalidPayrollSchemaPayloadError);
    expect((error as Error).message).toContain("conflicting");
  });

  it("rejects a versionless payload when requireExplicitVersion is set", () => {
    expect(() =>
      detectPayrollSchemaVersion({ entries: [] }, { requireExplicitVersion: true })
    ).toThrow(InvalidPayrollSchemaPayloadError);

    expect(() =>
      detectPayrollSchemaVersion({ schemaVersion: "1.0" }, { requireExplicitVersion: true })
    ).not.toThrow();
  });
});

describe("migratePayrollPayload", () => {
  it("passes a current payload through unchanged with no warnings", () => {
    const { payload, migrated, warnings } = migratePayrollPayload(CURRENT_PAYLOAD);

    expect(migrated).toBe(false);
    expect(warnings).toEqual([]);
    expect(payload).toEqual(CURRENT_PAYLOAD);
  });

  it("remaps legacy fields onto the current shape and warns for each one", () => {
    const { payload, migrated, warnings } = migratePayrollPayload({
      payments: [{ walletAddress: "GABC" }],
      salary: 5000,
      token: "native",
      employee: "emp-1",
    });

    expect(migrated).toBe(true);
    expect(payload.entries).toEqual([{ walletAddress: "GABC" }]);
    expect(payload.amount).toBe(5000);
    expect(payload.asset).toBe("native");
    expect(payload.employeeId).toBe("emp-1");
    expect(payload.payments).toBeUndefined();
    expect(payload.salary).toBeUndefined();
    expect(warnings.map((w) => w.field)).toEqual(["payments", "salary", "token", "employee"]);
  });

  it("prefers an explicit current field over a legacy alias", () => {
    const { payload, warnings } = migratePayrollPayload({
      payments: [{ recipient: "GOLD" }],
      entries: [{ recipient: "GNEW" }],
      salary: 1,
      amount: 2,
    });

    expect(payload.entries).toEqual([{ recipient: "GNEW" }]);
    expect(payload.amount).toBe(2);
    expect(warnings.map((w) => w.field).sort()).toEqual(["payments", "salary"]);
  });

  it("rejects non-object payloads with a typed error", () => {
    expect(() => migratePayrollPayload(null)).toThrow(InvalidPayrollSchemaPayloadError);
    expect(() => migratePayrollPayload([{ recipient: "GABC" }])).toThrow(
      InvalidPayrollSchemaPayloadError
    );
  });
});

describe("deprecation rule helpers", () => {
  it("finds only the legacy fields present on a payload", () => {
    const found = findDeprecatedPayrollFields({ walletAddress: "GABC", entries: [] });
    expect(found.map((d) => d.field)).toEqual(["walletAddress"]);
  });

  it("collects warnings that mirror the registry", () => {
    const warnings = collectPayrollFieldDeprecationWarnings({ token: "native" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ field: "token", replacement: "asset" });
  });
});

describe("detectPayrollPayloadSchema (payroll entry point)", () => {
  it("delegates to the schema detector", () => {
    const result = detectPayrollPayloadSchema(LEGACY_PAYLOAD);

    expect(result.version).toBe("0.9");
    expect(result.isDeprecatedVersion).toBe(true);
    expect(() => detectPayrollPayloadSchema({ schemaVersion: "3.1" })).toThrow(
      UnsupportedPayrollSchemaVersionError
    );
  });
});

describe("error code registry integration", () => {
  it("registers both schema detection codes as non-retryable validation errors", () => {
    for (const code of Object.values(PayrollSchemaErrorCode)) {
      const entry = ERROR_CODE_REGISTRY[code];
      expect(entry).toBeDefined();
      expect(entry.category).toBe("validation");
      expect(entry.retryable).toBe(false);
      expect(entry.suggestedMessage.length).toBeGreaterThan(0);
    }
  });
});
