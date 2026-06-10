# `@khoralabs/obp-react`

React components for visualizing **NBC chain graphs** — the linked sequence of offers, ports, and binds in an OBP session. Built on [XYFlow](https://xyflow.com).

## Installation

Peer dependencies: `react ^19`, `react-dom ^19`, `@xyflow/react ^12`.

```bash
bun add @khoralabs/obp-react @xyflow/react react react-dom
```

## Usage

```tsx
import { NbcChainScene, NbcChainProvider } from "@khoralabs/obp-react";

// graph is a NbcChainGraph built from persistence data via collectNbcChainGraph
<NbcChainProvider graph={graph}>
  <NbcChainScene />
</NbcChainProvider>
```

See [`examples/`](examples/) for a live dev server wired to a demo graph.

## Exports

- `NbcChainScene` — top-level canvas (wraps XYFlow `ReactFlow`)
- `NbcChainProvider` / `useNbcChain` — context for graph state
- `NbcChainCompound` / `NbcChainChrome` — layout building blocks
- `NbcChainDetails` — selected-node detail panel
- `collectNbcChainGraph` — builds a `NbcChainGraph` from an `ObpPersistenceClient`
- Layout utilities: `computeNbcChainLayout`, `fitNbcChainViewport`

## Scripts

- `bun test` — layout unit tests
- `bun run typecheck` — `tsc --noEmit`
