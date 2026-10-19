/**
 * Typed errors raised while detecting payroll payload schema versions.
 *
 * Both errors extend {@link ZkPayrollError}, so integrators can catch any SDK
 * error with a single `instanceof ZkPayrollError` check, and both carry stable
 * codes registered in `ERROR_CODE_REGISTRY`.
 *
 * @module
 */

import { ZkPayrollError, type ErrorContext } from "../core/errors";

/** Stable error codes for payroll payload schema detection failures. */
export const PayrollSchemaErrorCode = {
  /** The payload declares a schema version this SDK build does not support. */
  UNSUPPORTED_VERSION: "PAYROLL_SCHEMA_VERSION_UNSUPPORTED",
  /** The payload is not an object, or its version field is malformed. */
  INVALID_PAYLOAD: "PAYROLL_SCHEMA_PAYLOAD_INVALID",
} as const;

/** Union of payroll schema detection error codes. */
export type PayrollSchemaErrorCodeType =
  (typeof PayrollSchemaErrorCode)[keyof typeof PayrollSchemaErrorCode];

/**
 * Thrown when a payroll payload declares a schema version that this SDK build
 * does not support (for example a future `2.0` payload handed to an SDK that
 * understands up to `1.0`).
 */
export class UnsupportedPayrollSchemaVersionError extends ZkPayrollError {
  /** The unsupported version string exactly as it appeared on the payload. */
  public readonly detectedVersion: string;
  /** Schema versions this SDK build accepts, in ascending order. */
  public readonly supportedVersions: readonly string[];

  constructor(
    message: string,
    detectedVersion: string,
    supportedVersions: readonly string[],
    context: ErrorContext = {}
  ) {
    super(message, PayrollSchemaErrorCode.UNSUPPORTED_VERSION, {
      ...context,
      detectedVersion,
      supportedVersions: [...supportedVersions],
    });
    this.name = "UnsupportedPayrollSchemaVersionError";
    this.detectedVersion = detectedVersion;
    this.supportedVersions = supportedVersions;
  }
}

/**
 * Thrown when a payroll payload cannot be inspected for a schema version:
 * the payload is not an object, the version field has the wrong type, two
 * version fields disagree, or a required version field is missing while
 * `requireExplicitVersion` is set.
 */
export class InvalidPayrollSchemaPayloadError extends ZkPayrollError {
  /** The offending field path, when the failure is attributable to one field. */
  public readonly field?: string;

  constructor(message: string, field?: string, context: ErrorContext = {}) {
    super(message, PayrollSchemaErrorCode.INVALID_PAYLOAD, { ...context, field });
    this.name = "InvalidPayrollSchemaPayloadError";
    this.field = field;
  }
}
