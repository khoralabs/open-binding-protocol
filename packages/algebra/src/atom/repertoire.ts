import type { PortAtom, PortPolarity } from "./port-atom.ts";

export type RepertoireEntry = {
  atom: PortAtom;
  offerRef?: string;
};

/** Polarity-split library of port atoms an agent has exposed or bound. */
export class Repertoire {
  readonly #out = new Map<PortAtom, RepertoireEntry>();
  readonly #in = new Map<PortAtom, RepertoireEntry>();

  add(polarity: PortPolarity, entry: RepertoireEntry): this {
    const map = polarity === "expose" ? this.#out : this.#in;
    map.set(entry.atom, entry);
    return this;
  }

  remove(polarity: PortPolarity, atom: PortAtom): boolean {
    return (polarity === "expose" ? this.#out : this.#in).delete(atom);
  }

  has(polarity: PortPolarity, atom: PortAtom): boolean {
    return (polarity === "expose" ? this.#out : this.#in).has(atom);
  }

  getOut(): ReadonlyMap<PortAtom, RepertoireEntry> {
    return this.#out;
  }

  getIn(): ReadonlyMap<PortAtom, RepertoireEntry> {
    return this.#in;
  }

  outAtoms(): ReadonlySet<PortAtom> {
    return new Set(this.#out.keys());
  }

  inAtoms(): ReadonlySet<PortAtom> {
    return new Set(this.#in.keys());
  }
}
