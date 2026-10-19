/**
 * Types for payroll payload schema version detection.
 *
 * @module
 */

import type { PayrollSchemaVersion } from "./versions";

/**
 * A single field-level deprecation notice attached to a detected payload.
 *
 * Warnings are advisory: they never block processing, but each one names the
 * deprecated field, its replacement (when one exists), and the version that
 * will remove it.
 */
export interface PayrollSchemaDeprecationWarning {
  /** Deprecated field path found on the payload (or `schemaVersion` for version-level notices). */
  field: string;
  /** Human-readable explanation naming the replacement and removal target. */
  message: string;
  /** Schema version in which the field was deprecated. */
  deprecatedInVersion: string;
  /** Canonical field that replaces the deprecated one, when one exists. */
  replacement?: string;
  /** Schema version scheduled to remove the field, when announced. */
  removeInVersion?: string;
}

/**
 * How the detected version was determined.
 *
 * - `explicit` — read from a `schemaVersion` / `schema_version` field.
 * - `inferred` — the payload declares no version field; the version was derived
 *   from the payload's shape (legacy field names imply the legacy version).
 */
export type PayrollSchemaVersionSource = "explicit" | "inferred";

/** Result of detecting a payroll payload's schema version. */
export interface PayrollSchemaDetectionResult {
  /** Detected (and supported) payroll payload schema version. */
  version: PayrollSchemaVersion;
  /** Whether the version was read from the payload or inferred from its shape. */
  source: PayrollSchemaVersionSource;
  /** True when the detected version is supported but deprecated. */
  isDeprecatedVersion: boolean;
  /** Deprecation warnings for legacy fields and, when applicable, the version itself. */
  warnings: PayrollSchemaDeprecationWarning[];
  /** Deprecated field names found on the payload, in registry order. */
  deprecatedFields: string[];
}

/** Options controlling schema version detection. */
export interface PayrollSchemaDetectionOptions {
  /**
   * When true, a payload without a `schemaVersion` / `schema_version` field is
   * rejected with {@link InvalidPayrollSchemaPayloadError} instead of having its
   * version inferred from the payload shape. Defaults to `false`.
   */
  requireExplicitVersion?: boolean;
}
