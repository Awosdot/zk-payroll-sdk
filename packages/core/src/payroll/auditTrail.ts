/** Tamper-evident, serialisable audit trail for SDK payroll operations. */

import { createHash } from "node:crypto";

export interface AuditTrailEvent {
  sequence: number;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  previousHash: string;
  hash: string;
}
export interface AuditTrail {
  schemaVersion: "1.0";
  events: AuditTrailEvent[];
  rootHash: string;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class AuditTrailBuilder {
  private readonly events: AuditTrailEvent[] = [];
  constructor(private readonly clock: () => number = () => Date.now()) {}
  append(type: string, data: Record<string, unknown>): this {
    if (!type.trim()) throw new Error("Audit event type is required");
    const previousHash = this.events.at(-1)?.hash ?? "GENESIS";
    const event = {
      sequence: this.events.length,
      type,
      timestamp: this.clock(),
      data,
      previousHash,
    };
    this.events.push({ ...event, hash: digest(event) });
    return this;
  }
  build(): AuditTrail {
    return {
      schemaVersion: "1.0",
      events: this.events.map((event) => ({ ...event, data: { ...event.data } })),
      rootHash: this.events.at(-1)?.hash ?? "GENESIS",
    };
  }
}

export function verifyAuditTrail(trail: AuditTrail): boolean {
  if (trail.schemaVersion !== "1.0") return false;
  let previousHash = "GENESIS";
  for (let index = 0; index < trail.events.length; index++) {
    const event = trail.events[index];
    const { hash, ...unsigned } = event;
    if (
      event.sequence !== index ||
      event.previousHash !== previousHash ||
      digest(unsigned) !== hash
    )
      return false;
    previousHash = hash;
  }
  return trail.rootHash === previousHash;
}
