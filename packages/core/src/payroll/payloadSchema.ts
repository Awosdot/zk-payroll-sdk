/**
 * Payroll-domain entry point for payload schema version detection.
 *
 * Thin wrapper over `schema/detectPayrollSchemaVersion` so payroll integrators
 * can discover detection alongside the rest of the payroll helpers.
 *
 * @module
 */

import { detectPayrollSchemaVersion } from "../schema/detectPayrollSchemaVersion";
import type { PayrollSchemaDetectionOptions, PayrollSchemaDetectionResult } from "../schema/types";

/**
 * Detects the schema version of a payroll payload and reports deprecation
 * warnings for any legacy fields it still carries.
 *
 * @param payload - Payroll payload object to inspect.
 * @param options - Detection options (e.g. `requireExplicitVersion`).
 * @returns The detected supported version plus its deprecation warnings.
 * @throws {@link InvalidPayrollSchemaPayloadError} When the payload is not an
 *   object, a version field is malformed, or a required version field is missing.
 * @throws {@link UnsupportedPayrollSchemaVersionError} When the declared version
 *   is not supported by this SDK build.
 *
 * @example
 * const { version, warnings } = detectPayrollPayloadSchema(payload);
 * if (version === LEGACY_PAYROLL_SCHEMA_VERSION) await migratePayload(payload);
 */
export function detectPayrollPayloadSchema(
  payload: unknown,
  options: PayrollSchemaDetectionOptions = {}
): PayrollSchemaDetectionResult {
  return detectPayrollSchemaVersion(payload, options);
}
