# OBP React examples

Live demo for NBC chain UI installed from the [`khoralabs/react`](https://github.com/khoralabs/react) shadcn registry (`obp` kit)—XYFlow + Tailwind. Domain types come from `@khoralabs/obp-nbc`.

## Setup

```bash
bun install
# refresh UI from registry when needed:
bunx shadcn@latest add khoralabs/react/obp --yes --overwrite
```

## Development

```bash
bun dev       # hot-reload dev server (Bun HMR)
```

## Production

```bash
bun start     # NODE_ENV=production
```

Demo graph: `src/demo-graph.ts`. Host CSS owns `@import "tailwindcss"` and `@import "@xyflow/react/dist/style.css"`.
