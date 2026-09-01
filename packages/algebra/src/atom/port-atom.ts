import { sha256HexLowerFromUtf8String } from "@khoralabs/obp-core";

/** Port polarity for canonical atom encoding. */
export type PortPolarity = "expose" | "require";

/** Inputs for a domain-separated port atom π. */
export type PortAtomInput = {
  polarity: PortPolarity;
  schemaId: string;
  policyClass: string;
  offerClass: string;
  normName: string;
};

/** Class fields shared by polarized and glue atoms. */
export type PortAtomClasses = {
  schemaId: string;
  policyClass: string;
  offerClass: string;
};

const DEFAULT_PORT_ATOM_CLASSES: PortAtomClasses = {
  schemaId: "",
  policyClass: "",
  offerClass: "",
};

/** Lowercase hex SHA-256 port atom. */
export type PortAtom = string;

const PORT_ATOM_DOMAIN = "khora.obp.algebra.port-atom.v1";
const PORT_GLUE_DOMAIN = "khora.obp.algebra.port-glue.v1";

/** Canonical port atom π = H(domain ‖ polarity ‖ schema ‖ policy ‖ offer ‖ norm). */
export function portAtom(input: PortAtomInput): PortAtom {
  const payload = [
    PORT_ATOM_DOMAIN,
    input.polarity,
    input.schemaId,
    input.policyClass,
    input.offerClass,
    input.normName,
  ].join("\0");
  return sha256HexLowerFromUtf8String(payload);
}

/**
 * Polarity-neutral glue atom for cross-agent composability checks.
 * Matches expose-side out atoms with require-side in atoms on shared class fields.
 */
export function portGlueAtom(normName: string, classes: PortAtomClasses): PortAtom {
  const payload = [
    PORT_GLUE_DOMAIN,
    classes.schemaId,
    classes.policyClass,
    classes.offerClass,
    normName,
  ].join("\0");
  return sha256HexLowerFromUtf8String(payload);
}

/** Build a port atom from an interface port name and shared class fields. */
export function portAtomFromName(
  polarity: PortPolarity,
  normName: string,
  classes: Partial<PortAtomClasses> = {},
): PortAtom {
  const merged = { ...DEFAULT_PORT_ATOM_CLASSES, ...classes };
  return portAtom({ polarity, normName, ...merged });
}
