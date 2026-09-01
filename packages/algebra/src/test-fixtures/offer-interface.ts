import type { OfferInterface, PortName } from "../interface/offer-interface.ts";

export function iface(inPorts: readonly PortName[], outPorts: readonly PortName[]): OfferInterface {
  return { in: new Set(inPorts), out: new Set(outPorts) };
}

export function portNames(o: OfferInterface): {
  in: readonly PortName[];
  out: readonly PortName[];
} {
  return {
    in: [...o.in].sort(),
    out: [...o.out].sort(),
  };
}
