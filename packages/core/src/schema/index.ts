/**
 * Payroll payload schema detection.
 *
 * @module
 */

export {
  PAYROLL_SCHEMA_VERSION,
  CURRENT_PAYROLL_SCHEMA_VERSION,
  LEGACY_PAYROLL_SCHEMA_VERSION,
  SUPPORTED_PAYROLL_SCHEMA_VERSIONS,
  DEPRECATED_PAYROLL_SCHEMA_VERSIONS,
  isSupportedPayrollSchemaVersion,
  isDeprecatedPayrollSchemaVersion,
} from "./versions";
export type { PayrollSchemaVersion } from "./versions";

export { detectPayrollSchemaVersion } from "./detectPayrollSchemaVersion";

export {
  PayrollSchemaErrorCode,
  UnsupportedPayrollSchemaVersionError,
  InvalidPayrollSchemaPayloadError,
} from "./errors";
export type { PayrollSchemaErrorCodeType } from "./errors";

export type {
  PayrollSchemaDeprecationWarning,
  PayrollSchemaVersionSource,
  PayrollSchemaDetectionResult,
  PayrollSchemaDetectionOptions,
} from "./types";
