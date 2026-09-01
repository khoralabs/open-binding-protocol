import type { PortName } from "./offer-interface.ts";

export function unionSets(
  a: ReadonlySet<PortName>,
  b: ReadonlySet<PortName>,
): ReadonlySet<PortName> {
  return new Set([...a, ...b]);
}

export function subtractSet(
  source: ReadonlySet<PortName>,
  remove: ReadonlySet<PortName>,
): ReadonlySet<PortName> {
  const out = new Set<PortName>();
  for (const name of source) {
    if (!remove.has(name)) out.add(name);
  }
  return out;
}

export function mapSet(
  source: ReadonlySet<PortName>,
  f: (name: PortName) => PortName,
): ReadonlySet<PortName> {
  return new Set([...source].map(f));
}

export function setsEqual(a: ReadonlySet<PortName>, b: ReadonlySet<PortName>): boolean {
  if (a.size !== b.size) return false;
  for (const name of a) {
    if (!b.has(name)) return false;
  }
  return true;
}
