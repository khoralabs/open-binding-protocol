import type { OfferInterface, PortName } from "./offer-interface.ts";
import { rename } from "./wiring.ts";

/** Cross-network rename family ℱ: map or function on port names. Unknown names pass through. */
export type RenameFamily = ReadonlyMap<PortName, PortName> | ((name: PortName) => PortName);

/** Apply ℱ to a single port name (unknown keys pass through). */
export function applyRenameFamily(name: PortName, family: RenameFamily): PortName {
  if (typeof family === "function") return family(name);
  return family.get(name) ?? name;
}

/** Apply ℱ to every port on an interface boundary. */
export function applyRenameFamilyToInterface(
  o: OfferInterface,
  family: RenameFamily,
): OfferInterface {
  return rename(o, (name) => applyRenameFamily(name, family));
}

/** Compose two rename families: apply g then f (rename(f∘g)). */
export function composeRenameFamilies(
  f: RenameFamily,
  g: RenameFamily,
): (name: PortName) => PortName {
  return (name) => applyRenameFamily(applyRenameFamily(name, g), f);
}
