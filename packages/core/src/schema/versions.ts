/**
 * Supported payroll payload schema versions.
 *
 * Every payroll payload the SDK accepts is identified by a schema version.
 * Integrators can compare a detected version against these constants to decide
 * whether a payload needs migration before it is submitted.
 *
 * @module
 */

/**
 * Registry of every payroll payload schema version this SDK build understands.
 *
 * - `0.9` — legacy payloads (deprecated; may still carry removed field names).
 * - `1.0` — current payloads.
 */
export const PAYROLL_SCHEMA_VERSION = {
  V0_9: "0.9",
  V1_0: "1.0",
} as const;

/** Union of all supported payroll payload schema versions. */
export type PayrollSchemaVersion =
  (typeof PAYROLL_SCHEMA_VERSION)[keyof typeof PAYROLL_SCHEMA_VERSION];

/** The current payroll payload schema version emitted by this SDK build. */
export const CURRENT_PAYROLL_SCHEMA_VERSION: PayrollSchemaVersion = PAYROLL_SCHEMA_VERSION.V1_0;

/** The legacy payroll payload schema version retained for backward compatibility. */
export const LEGACY_PAYROLL_SCHEMA_VERSION: PayrollSchemaVersion = PAYROLL_SCHEMA_VERSION.V0_9;

/** Every supported payroll payload schema version, in ascending order. */
export const SUPPORTED_PAYROLL_SCHEMA_VERSIONS: readonly PayrollSchemaVersion[] = [
  PAYROLL_SCHEMA_VERSION.V0_9,
  PAYROLL_SCHEMA_VERSION.V1_0,
];

/**
 * Supported schema versions that are deprecated: payloads detected at one of
 * these versions still parse, but integrators should migrate to
 * {@link CURRENT_PAYROLL_SCHEMA_VERSION}.
 */
export const DEPRECATED_PAYROLL_SCHEMA_VERSIONS: readonly PayrollSchemaVersion[] = [
  PAYROLL_SCHEMA_VERSION.V0_9,
];

/**
 * Whether a value identifies a payroll payload schema version supported by
 * this SDK build.
 *
 * @param value - Raw value read from a payload's version field.
 */
export function isSupportedPayrollSchemaVersion(value: unknown): value is PayrollSchemaVersion {
  return (SUPPORTED_PAYROLL_SCHEMA_VERSIONS as readonly string[]).includes(value as string);
}

/**
 * Whether a value identifies a supported but deprecated payroll payload
 * schema version.
 *
 * @param value - Raw value read from a payload's version field.
 */
export function isDeprecatedPayrollSchemaVersion(value: unknown): boolean {
  return (
    isSupportedPayrollSchemaVersion(value) &&
    (DEPRECATED_PAYROLL_SCHEMA_VERSIONS as readonly string[]).includes(value)
  );
}
