import { ObpError } from "@khoralabs/obp-core";
import type { OfferInterface, PortName } from "./offer-interface.ts";
import { mapSet, subtractSet, unionSets } from "./set-ops.ts";

/** Sequential composition O₂ ∘ₚ O₁ along shared port p. */
export function compose(o2: OfferInterface, o1: OfferInterface, p: PortName): OfferInterface {
  if (!o1.out.has(p)) {
    throw new ObpError("VALIDATION", `compose: port ${p} not in out(O1)`);
  }
  if (!o2.in.has(p)) {
    throw new ObpError("VALIDATION", `compose: port ${p} not in in(O2)`);
  }

  const inPorts = new Set(o1.in);
  for (const name of o2.in) {
    if (name !== p) inPorts.add(name);
  }

  const outPorts = new Set(o2.out);
  for (const name of o1.out) {
    if (name !== p) outPorts.add(name);
  }

  return { in: inPorts, out: outPorts };
}

/** Parallel composition O₁ ⊗ O₂. */
export function parallel(o1: OfferInterface, o2: OfferInterface): OfferInterface {
  return {
    in: unionSets(o1.in, o2.in),
    out: unionSets(o1.out, o2.out),
  };
}

/** Restriction / encapsulation: hide ports from the external boundary. */
export function hide(o: OfferInterface, ports: Iterable<PortName>): OfferInterface {
  const hideSet = new Set(ports);
  return {
    in: subtractSet(o.in, hideSet),
    out: subtractSet(o.out, hideSet),
  };
}

/** Relabel external port names via f. */
export function rename(o: OfferInterface, f: (name: PortName) => PortName): OfferInterface {
  return {
    in: mapSet(o.in, f),
    out: mapSet(o.out, f),
  };
}

/**
 * Choice O₁ + O₂ at the interface level (union of ports).
 * OBP core does not enforce mutual exclusion; hosts decide bind exclusivity.
 */
export function choice(o1: OfferInterface, o2: OfferInterface): OfferInterface {
  return parallel(o1, o2);
}
