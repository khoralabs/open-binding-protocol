/** Named port on an offer boundary (OBP port id or normalized name). */
export type PortName = string;

/** Open interface: required ports (in) and provided ports (out). */
export type OfferInterface = {
  readonly in: ReadonlySet<PortName>;
  readonly out: ReadonlySet<PortName>;
};

/** Build an interface from explicit import/export port name sets. */
export function offerInterface(
  inPorts: Iterable<PortName>,
  outPorts: Iterable<PortName>,
): OfferInterface {
  return { in: new Set(inPorts), out: new Set(outPorts) };
}

/** Project expose/bind edge lists for one offer into interface sets. */
export function fromExposesBinds(
  exposedPortIds: Iterable<PortName>,
  boundPortIds: Iterable<PortName>,
): OfferInterface {
  return offerInterface(boundPortIds, exposedPortIds);
}
