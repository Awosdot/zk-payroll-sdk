/**
 * Payroll payload schema version detector.
 *
 * Identifies the schema version of a payroll payload and reports deprecation
 * warnings for legacy fields, so integrators can migrate safely as payloads
 * evolve.
 *
 * Detection rules:
 * 1. A `schemaVersion` (or `schema_version`) field is read as the explicit
 *    version. Two version fields with different values are rejected.
 * 2. Without a version field the version is inferred from the payload shape:
 *    payloads carrying legacy field names are treated as `0.9`, everything
 *    else as `1.0` (set `requireExplicitVersion` to reject instead).
 * 3. Supported-but-deprecated versions and legacy fields produce warnings;
 *    unsupported versions and malformed payloads fail with typed errors.
 *
 * @module
 */

import { collectPayrollFieldDeprecationWarnings } from "../migrations/payrollFieldDeprecations";
import { InvalidPayrollSchemaPayloadError, UnsupportedPayrollSchemaVersionError } from "./errors";
import type {
  PayrollSchemaDetectionOptions,
  PayrollSchemaDetectionResult,
  PayrollSchemaDeprecationWarning,
  PayrollSchemaVersionSource,
} from "./types";
import {
  CURRENT_PAYROLL_SCHEMA_VERSION,
  LEGACY_PAYROLL_SCHEMA_VERSION,
  SUPPORTED_PAYROLL_SCHEMA_VERSIONS,
  isDeprecatedPayrollSchemaVersion,
  isSupportedPayrollSchemaVersion,
  type PayrollSchemaVersion,
} from "./versions";

/** Field names a payroll payload may use to declare its schema version. */
const SCHEMA_VERSION_FIELDS = ["schemaVersion", "schema_version"] as const;

function payloadTypeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function readDeclaredVersion(
  record: Record<string, unknown>,
  context: Record<string, unknown>
): { field: string; value: unknown } | undefined {
  const declared = SCHEMA_VERSION_FIELDS.filter(
    (field) => record[field] !== undefined && record[field] !== null
  );

  if (declared.length === 0) {
    return undefined;
  }

  if (declared.length > 1) {
    const [first, second] = declared;
    if (record[first] !== record[second]) {
      throw new InvalidPayrollSchemaPayloadError(
        `Payroll payload declares conflicting schema versions: ${first}=${JSON.stringify(
          record[first]
        )} and ${second}=${JSON.stringify(record[second])}. Keep a single version field in sync.`,
        second,
        context
      );
    }
  }

  return { field: declared[0], value: record[declared[0]] };
}

function detectVersionField(
  record: Record<string, unknown>,
  options: PayrollSchemaDetectionOptions
): { version: PayrollSchemaVersion; source: PayrollSchemaVersionSource } | undefined {
  const context = { fields: [...SCHEMA_VERSION_FIELDS] };
  const declared = readDeclaredVersion(record, context);

  if (!declared) {
    if (options.requireExplicitVersion) {
      throw new InvalidPayrollSchemaPayloadError(
        'Payroll payload is missing a schema version field; add "schemaVersion" (or "schema_version") set to a supported version such as "1.0", or allow version inference by clearing `requireExplicitVersion`.',
        "schemaVersion",
        context
      );
    }

    const version = hasLegacyFieldNames(record)
      ? LEGACY_PAYROLL_SCHEMA_VERSION
      : CURRENT_PAYROLL_SCHEMA_VERSION;
    return { version, source: "inferred" };
  }

  if (typeof declared.value !== "string") {
    throw new InvalidPayrollSchemaPayloadError(
      `Payroll payload field "${declared.field}" must be a string such as "1.0"; received ${payloadTypeOf(
        declared.value
      )}.`,
      declared.field,
      { ...context, valueType: payloadTypeOf(declared.value) }
    );
  }

  const version = declared.value.trim();
  if (version === "") {
    throw new InvalidPayrollSchemaPayloadError(
      `Payroll payload field "${declared.field}" must be a non-empty schema version such as "1.0".`,
      declared.field,
      context
    );
  }

  if (!isSupportedPayrollSchemaVersion(version)) {
    throw new UnsupportedPayrollSchemaVersionError(
      `Unsupported payroll payload schema version "${version}". This SDK build supports: ${SUPPORTED_PAYROLL_SCHEMA_VERSIONS.join(
        ", "
      )}. Upgrade the SDK or reserialize the payload to a supported version.`,
      version,
      SUPPORTED_PAYROLL_SCHEMA_VERSIONS,
      { ...context, field: declared.field }
    );
  }

  return { version, source: "explicit" };
}

function hasLegacyFieldNames(record: Record<string, unknown>): boolean {
  return collectPayrollFieldDeprecationWarnings(record).length > 0;
}

function buildVersionWarning(
  version: PayrollSchemaVersion
): PayrollSchemaDeprecationWarning | undefined {
  if (!isDeprecatedPayrollSchemaVersion(version)) {
    return undefined;
  }
  return {
    field: "schemaVersion",
    message: `Payroll payload schema version ${version} is deprecated; migrate the payload to ${CURRENT_PAYROLL_SCHEMA_VERSION}.`,
    deprecatedInVersion: version,
    replacement: CURRENT_PAYROLL_SCHEMA_VERSION,
  };
}

/**
 * Detects the schema version of a payroll payload and collects deprecation
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
 * const { version, warnings } = detectPayrollSchemaVersion(payload);
 * warnings.forEach((w) => console.warn(`${w.field}: ${w.message}`));
 */
export function detectPayrollSchemaVersion(
  payload: unknown,
  options: PayrollSchemaDetectionOptions = {}
): PayrollSchemaDetectionResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new InvalidPayrollSchemaPayloadError(
      `Payroll payload must be a non-null object to detect its schema version; received ${payloadTypeOf(
        payload
      )}.`,
      "payload",
      { payloadType: payloadTypeOf(payload) }
    );
  }

  const record = payload as Record<string, unknown>;
  const detected = detectVersionField(record, options);
  if (!detected) {
    throw new InvalidPayrollSchemaPayloadError(
      "Payroll payload schema version could not be determined.",
      "schemaVersion"
    );
  }

  const fieldWarnings = collectPayrollFieldDeprecationWarnings(record);
  const versionWarning = buildVersionWarning(detected.version);
  const warnings = versionWarning ? [versionWarning, ...fieldWarnings] : fieldWarnings;

  return {
    version: detected.version,
    source: detected.source,
    isDeprecatedVersion: isDeprecatedPayrollSchemaVersion(detected.version),
    warnings,
    deprecatedFields: fieldWarnings.map((warning) => warning.field),
  };
}
