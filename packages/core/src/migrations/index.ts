/**
 * Payroll payload schema detection and migration helpers.
 *
 * @module
 */

export {
  PAYROLL_FIELD_DEPRECATIONS,
  findDeprecatedPayrollFields,
  collectPayrollFieldDeprecationWarnings,
  migratePayrollPayload,
} from "./payrollFieldDeprecations";
export type {
  PayrollFieldDeprecation,
  PayrollPayloadMigrationResult,
} from "./payrollFieldDeprecations";
