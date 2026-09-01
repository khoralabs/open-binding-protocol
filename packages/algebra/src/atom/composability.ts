import type { PortAtom } from "./port-atom.ts";
import { type PortAtomClasses, portGlueAtom } from "./port-atom.ts";

export type StructuralComposability = {
  composable: boolean;
  intersection: ReadonlySet<PortAtom>;
};

/**
 * True iff the same polarized atom π appears in both sets.
 * For cross-agent glue (expose out vs require in), use {@link structuralGlueComposability}.
 */
export function structuralComposability(
  aOut: Iterable<PortAtom>,
  bIn: Iterable<PortAtom>,
): StructuralComposability {
  const inSet = bIn instanceof Set ? bIn : new Set(bIn);
  const intersection = new Set<PortAtom>();
  for (const atom of aOut) {
    if (inSet.has(atom)) intersection.add(atom);
  }
  return {
    composable: intersection.size > 0,
    intersection,
  };
}

/** Cross-polarity composability on glue atoms derived from port names + classes. */
export function structuralGlueComposability(
  aOut: Iterable<{ normName: string; classes: PortAtomClasses }>,
  bIn: Iterable<{ normName: string; classes: PortAtomClasses }>,
): StructuralComposability {
  const inGlue = new Set([...bIn].map((p) => portGlueAtom(p.normName, p.classes)));
  const intersection = new Set<PortAtom>();
  for (const port of aOut) {
    const glue = portGlueAtom(port.normName, port.classes);
    if (inGlue.has(glue)) intersection.add(glue);
  }
  return {
    composable: intersection.size > 0,
    intersection,
  };
}

/** Structural composability after applying rename to A's out-atoms (via map on names before atomization). */
export function structuralComposabilityAfterRename(
  aOut: Iterable<PortAtom>,
  bIn: Iterable<PortAtom>,
  renameAtom: (atom: PortAtom) => PortAtom,
): StructuralComposability {
  const renamedOut = [...aOut].map(renameAtom);
  return structuralComposability(renamedOut, bIn);
}
