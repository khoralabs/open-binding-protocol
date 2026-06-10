import { ObpError } from "@khoralabs/obp-errors";
import type { Port } from "@khoralabs/obp-model";
import { resolveCanonicalPortId } from "./canonical-port-ref";

/** NBC default when **`max_bindings`** is omitted at expose. */
export const DEFAULT_MAX_BINDINGS = 1;

/** Normalize expose-time **`max_bindings`**: omitted → 1; must be integer ≥ 1. */
export function normalizeMaxBindings(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_BINDINGS;
  if (!Number.isInteger(value) || value < 1) {
    throw new ObpError("VALIDATION", "max_bindings must be a positive integer (>= 1)");
  }
  return value;
}

export function countBindsForCanonicalPort(
  binds: readonly { portId: string }[],
  portsById: ReadonlyMap<string, Port>,
  canonicalId: string,
): number {
  let count = 0;
  for (const b of binds) {
    const resolved = resolveCanonicalPortId(portsById, b.portId);
    if (resolved.ok && resolved.canonicalId === canonicalId) {
      count++;
    }
  }
  return count;
}

export function assertCanonicalBindCapacity(params: {
  targetPortId: string;
  portsById: ReadonlyMap<string, Port>;
  maxBindingsByPortId: ReadonlyMap<string, number>;
  binds: readonly { portId: string }[];
}): void {
  const resolved = resolveCanonicalPortId(params.portsById, params.targetPortId);
  if (!resolved.ok) {
    if (resolved.reason === "cycle") {
      throw new ObpError("REF_CYCLE", `Port ref cycle: ${resolved.path.join(" -> ")}`);
    }
    throw new ObpError("REF_MISSING", `Missing port in ref chain: ${resolved.missingId}`);
  }
  const canonicalId = resolved.canonicalId;
  const maxBindings = params.maxBindingsByPortId.get(canonicalId);
  if (maxBindings === undefined) {
    throw new ObpError("NOT_FOUND", `Port not found: ${canonicalId}`);
  }
  const count = countBindsForCanonicalPort(params.binds, params.portsById, canonicalId);
  if (count >= maxBindings) {
    throw new ObpError(
      "MAX_BINDINGS",
      `max_bindings (${maxBindings}) exceeded for canonical port ${canonicalId}`,
    );
  }
}
