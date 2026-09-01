import type { PortAtom } from "../atom/port-atom.ts";
import type { LibraryCommitment } from "../commitment/merkle-library.ts";

/** Raised when an intersection proof API is invoked before implementation exists. */
export class NotImplementedIntersectionError extends Error {
  readonly feature: string;

  constructor(feature: string) {
    super(`${feature} is not implemented in @khoralabs/obp-algebra v1`);
    this.name = "NotImplementedIntersectionError";
    this.feature = feature;
  }
}

/**
 * Oblivious set-intersection prover over committed polarity-split libraries.
 * Future: semi-honest or malicious PSI without revealing non-intersection elements.
 */
export type ObliviousIntersectionProver = {
  prove(params: ObliviousIntersectionParams): Promise<ObliviousIntersectionResult>;
};

export type ObliviousIntersectionParams = {
  localOutCommitment: LibraryCommitment;
  peerInCommitment: LibraryCommitment;
  /** Optional rename family id (registered ℱ); host resolves to atom map. */
  renameFamilyId?: string;
};

export type ObliviousIntersectionResult = {
  /** True when ∃ π ∈ out(A) ∩ in(B) (possibly after ℱ). */
  composable: boolean;
  /** OPRF/session capability unlocking matched ports in Vellum (future). */
  matchCapability?: Uint8Array;
};

/**
 * Non-interactive proof that two committed libraries have non-empty structural glue.
 * Future: ZK proof of |out ∩ in| ≥ k without set disclosure.
 */
export type ZkIntersectionProof = {
  proofBytes: Uint8Array;
  publicInputs: {
    localOutRoot: string;
    peerInRoot: string;
    minCardinality: number;
  };
};

export type ComposabilityPotentialProof = ZkIntersectionProof;

/** Stub: polarity-split PSI over commitments (not implemented in v1). */
export function proveComposabilityPotential(_params: ObliviousIntersectionParams): never {
  throw new NotImplementedIntersectionError("proveComposabilityPotential");
}

/** Stub: verify ZK/PSI composability attestation (not implemented in v1). */
export function verifyComposabilityPotential(_proof: ComposabilityPotentialProof): never {
  throw new NotImplementedIntersectionError("verifyComposabilityPotential");
}

/**
 * Documented predicate for future proofs: matches {@link structuralComposability}
 * intent — non-empty intersection of out-atoms with in-atoms.
 */
export const COMPOSABILITY_PREDICATE = "exists pi: pi in out(A) and pi in in(B)" as const;

export type PolaritySplitCommitments = {
  out: LibraryCommitment;
  in: LibraryCommitment;
};

/** Type fixture: intersection APIs accept polarity-split commitment roots. */
export function acceptPolaritySplitCommitments(
  commitments: PolaritySplitCommitments,
): PolaritySplitCommitments {
  return commitments;
}

/** Map port atoms through a rename (ℱ) before intersection (host supplies map). */
export function renameAtomsForIntersection(
  atoms: Iterable<PortAtom>,
  renameAtom: (atom: PortAtom) => PortAtom,
): PortAtom[] {
  return [...atoms].map(renameAtom);
}
