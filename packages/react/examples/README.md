# OBP React examples

Live dev example for `@khoralabs/obp-react` — renders an NBC chain graph using XYFlow and Tailwind.

## Setup

```bash
bun install
```

## Development

```bash
bun dev       # hot-reload dev server (Bun HMR)
```

## Production

```bash
bun start     # NODE_ENV=production
```

The example imports `@khoralabs/obp-react` from the workspace and renders a demo NBC chain graph sourced from `src/demo-graph.ts`. Edit that file to explore different graph shapes.
