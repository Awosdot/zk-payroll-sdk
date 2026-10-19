/**
 * Payroll payload field deprecation rules (#schema-detector).
 *
 * Declares the legacy (schema `0.9`) payroll payload field names that current
 * payloads no longer use, and provides helpers to collect clear, actionable
 * deprecation warnings for those fields and to remap them onto the current
 * (schema `1.0`) shape.
 *
 * The registry is the single source of truth shared by schema detection and
 * payload migration, so a field is always warned about and remapped by exactly
 * the same rule.
 *
 * @module
 */

import type { PayrollSchemaDeprecationWarning } from "../schema/types";
import { InvalidPayrollSchemaPayloadError } from "../schema/errors";

/** A single deprecated payroll payload field and its migration target. */
export interface PayrollFieldDeprecation {
  /** Deprecated field name as it appears on legacy payloads. */
  field: string;
  /** Canonical field that replaces the deprecated one, when one exists. */
  replacement?: string;
  /** Schema version in which the field was deprecated. */
  deprecatedInVersion: string;
  /** Schema version scheduled to remove the field, when announced. */
  removeInVersion?: string;
  /** Human-readable deprecation notice, including the replacement when known. */
  message: string;
}

/**
 * Legacy payroll payload fields understood by the migrator, keyed by the
 * deprecated field name. Insertion order is the order warnings are reported.
 */
export const PAYROLL_FIELD_DEPRECATIONS: Readonly<Record<string, PayrollFieldDeprecation>> = {
  payments: {
    field: "payments",
    replacement: "entries",
    deprecatedInVersion: "0.9",
    removeInVersion: "2.0",
    message:
      "`payments` is deprecated since payroll schema 0.9; use `entries` instead. It is scheduled for removal in schema 2.0.",
  },
  walletAddress: {
    field: "walletAddress",
    replacement: "recipient",
    deprecatedInVersion: "0.9",
    removeInVersion: "2.0",
    message:
      "`walletAddress` is deprecated since payroll schema 0.9; use the `recipient` field on each entry instead. It is scheduled for removal in schema 2.0.",
  },
  salary: {
    field: "salary",
    replacement: "amount",
    deprecatedInVersion: "0.9",
    removeInVersion: "2.0",
    message:
      "`salary` is deprecated since payroll schema 0.9; use the per-entry `amount` field instead (integer in the smallest unit). It is scheduled for removal in schema 2.0.",
  },
  token: {
    field: "token",
    replacement: "asset",
    deprecatedInVersion: "0.9",
    removeInVersion: "2.0",
    message:
      '`token` is deprecated since payroll schema 0.9; use `asset` instead (e.g. "native" or a token contract ID). It is scheduled for removal in schema 2.0.',
  },
  employee: {
    field: "employee",
    replacement: "employeeId",
    deprecatedInVersion: "0.9",
    removeInVersion: "2.0",
    message:
      "`employee` is deprecated since payroll schema 0.9; use the stable `employeeId` identifier on each entry instead. It is scheduled for removal in schema 2.0.",
  },
};

/**
 * Returns the deprecation rules for legacy fields present on a payload, in
 * registry order. A field counts as present when its value is neither
 * `undefined` nor `null`.
 *
 * @param payload - Payload object to inspect.
 */
export function findDeprecatedPayrollFields(
  payload: Record<string, unknown>
): PayrollFieldDeprecation[] {
  const found: PayrollFieldDeprecation[] = [];
  for (const deprecation of Object.values(PAYROLL_FIELD_DEPRECATIONS)) {
    const value = payload[deprecation.field];
    if (value !== undefined && value !== null) {
      found.push(deprecation);
    }
  }
  return found;
}

/**
 * Builds a deprecation warning for every legacy field present on a payload.
 *
 * @param payload - Payload object to inspect.
 * @returns One warning per deprecated field, in registry order.
 */
export function collectPayrollFieldDeprecationWarnings(
  payload: Record<string, unknown>
): PayrollSchemaDeprecationWarning[] {
  return findDeprecatedPayrollFields(payload).map((deprecation) => ({
    field: deprecation.field,
    message: deprecation.message,
    deprecatedInVersion: deprecation.deprecatedInVersion,
    replacement: deprecation.replacement,
    removeInVersion: deprecation.removeInVersion,
  }));
}

/** Result of migrating a payroll payload to the current schema shape. */
export interface PayrollPayloadMigrationResult {
  /** Payload remapped onto the current schema shape (original input is untouched). */
  payload: Record<string, unknown>;
  /** True when at least one deprecated field was remapped or dropped. */
  migrated: boolean;
  /** One warning per deprecated field found, in registry order. */
  warnings: PayrollSchemaDeprecationWarning[];
}

/**
 * Migrates a legacy payroll payload onto the current schema shape, remapping
 * deprecated fields and collecting a warning for each one.
 *
 * Mirrors `migrateConfig`: current-schema fields are copied first so an
 * explicit current value always wins over a legacy alias, and legacy fields
 * are remapped only when their replacement is not already set.
 *
 * @param input - Legacy or current payroll payload object.
 * @throws {@link InvalidPayrollSchemaPayloadError} When `input` is not an object.
 *
 * @example
 * const { payload, warnings } = migratePayrollPayload(legacyPayload);
 * if (warnings.length) console.warn(warnings.map((w) => w.message));
 */
export function migratePayrollPayload(input: unknown): PayrollPayloadMigrationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new InvalidPayrollSchemaPayloadError(
      "Payroll payload must be a non-null object to migrate its schema fields",
      "payload",
      { payloadType: input === null ? "null" : Array.isArray(input) ? "array" : typeof input }
    );
  }

  const source = input as Record<string, unknown>;
  const deprecations = findDeprecatedPayrollFields(source);
  const warnings = collectPayrollFieldDeprecationWarnings(source);

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!(key in PAYROLL_FIELD_DEPRECATIONS)) {
      payload[key] = value;
    }
  }

  for (const deprecation of deprecations) {
    if (deprecation.replacement && payload[deprecation.replacement] === undefined) {
      payload[deprecation.replacement] = source[deprecation.field];
    }
  }

  return { payload, migrated: deprecations.length > 0, warnings };
}
