import { type Sha256HexLower, sha256HexLowerFromUtf8String } from "@khoralabs/obp-core";
import type { PortAtom } from "../atom/port-atom.ts";

const MERKLE_LEAF_DOMAIN = "khora.obp.algebra.merkle-leaf.v1";
const MERKLE_NODE_DOMAIN = "khora.obp.algebra.merkle-node.v1";
const MERKLE_EMPTY_DOMAIN = "khora.obp.algebra.merkle-empty.v1";

export type LibraryCommitment = {
  /** Merkle root over sorted library atoms. */
  root: Sha256HexLower;
  /** Sorted unique leaves (atoms) included in the commitment. */
  leaves: readonly PortAtom[];
};

export type MembershipProof = {
  leaf: PortAtom;
  root: Sha256HexLower;
  /** Sibling hashes from leaf to root (empty when single-leaf tree). */
  path: readonly MembershipProofStep[];
};

export type MembershipProofStep = {
  sibling: Sha256HexLower;
  /** Position of the sibling relative to the running hash (left = sibling is left child). */
  side: "left" | "right";
};

function merkleLeafHash(atom: PortAtom): Sha256HexLower {
  return sha256HexLowerFromUtf8String(`${MERKLE_LEAF_DOMAIN}\0${atom}`);
}

function merkleNodeHash(left: Sha256HexLower, right: Sha256HexLower): Sha256HexLower {
  return sha256HexLowerFromUtf8String(`${MERKLE_NODE_DOMAIN}\0${left}\0${right}`);
}

function emptyLibraryRoot(): Sha256HexLower {
  return sha256HexLowerFromUtf8String(MERKLE_EMPTY_DOMAIN);
}

/** Build Merkle layers from leaf hashes (bottom-up). Duplicates last node when odd count. */
function buildMerkleLayers(leafHashes: readonly Sha256HexLower[]): Sha256HexLower[][] {
  if (leafHashes.length === 0) return [[emptyLibraryRoot()]];

  const layers: Sha256HexLower[][] = [[...leafHashes]];
  let current: Sha256HexLower[] = [...leafHashes];

  while (current.length > 1) {
    const next: Sha256HexLower[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      if (!left) break;
      const right = current[i + 1] ?? left;
      next.push(merkleNodeHash(left, right));
    }
    layers.push(next);
    current = next;
  }

  return layers;
}

type LeafIndex = {
  layers: Sha256HexLower[][];
  leafIndex: number;
};

function indexLeaf(atom: PortAtom, leaves: readonly PortAtom[]): LeafIndex | null {
  const leafIndex = leaves.indexOf(atom);
  if (leafIndex < 0) return null;

  const leafHashes = leaves.map(merkleLeafHash);
  const layers = buildMerkleLayers(leafHashes);
  return { layers, leafIndex };
}

/** Commit(ℒ): deterministic Merkle root over sorted unique atoms. */
export function commitLibrary(atoms: Iterable<PortAtom>): LibraryCommitment {
  const leaves = [...new Set(atoms)].sort();
  if (leaves.length === 0) {
    return { root: emptyLibraryRoot(), leaves };
  }

  const layers = buildMerkleLayers(leaves.map(merkleLeafHash));
  const root = layers.at(-1)?.[0];
  if (!root) {
    return { root: emptyLibraryRoot(), leaves };
  }
  return { root, leaves };
}

/** Merkle membership proof for atom in commitment. */
export function proveMembership(
  atom: PortAtom,
  commitment: LibraryCommitment,
): MembershipProof | null {
  const indexed = indexLeaf(atom, commitment.leaves);
  if (!indexed) return null;

  const { layers, leafIndex } = indexed;
  const path: MembershipProofStep[] = [];
  let index = leafIndex;

  for (let level = 0; level < layers.length - 1; level++) {
    const layer = layers[level];
    if (!layer) break;

    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;
    const sibling = layer[siblingIndex] ?? layer[index];
    if (!sibling) break;

    path.push({
      sibling,
      side: isRight ? "left" : "right",
    });
    index = Math.floor(index / 2);
  }

  return {
    leaf: atom,
    root: commitment.root,
    path,
  };
}

function hashUp(leafHash: Sha256HexLower, path: readonly MembershipProofStep[]): Sha256HexLower {
  let current = leafHash;
  for (const step of path) {
    current =
      step.side === "left"
        ? merkleNodeHash(step.sibling, current)
        : merkleNodeHash(current, step.sibling);
  }
  return current;
}

/** Verify a membership proof against an expected root. */
export function verifyMembership(proof: MembershipProof): boolean {
  const leafHash = merkleLeafHash(proof.leaf);
  const computed = hashUp(leafHash, proof.path);
  return computed === proof.root;
}

/** Verify membership against a commitment root. */
export function verifyMembershipInCommitment(
  proof: MembershipProof,
  commitment: LibraryCommitment,
): boolean {
  if (proof.root !== commitment.root) return false;
  return verifyMembership(proof);
}
