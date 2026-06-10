# Contributing

Thanks for helping improve `@khoralabs/obp`. This repo is a Bun workspace with protocol specs and TypeScript packages under `packages/`.

## Prerequisites

- [Bun](https://bun.sh) (see `package.json` engines / CI)
- For Smithy model changes: [Smithy CLI](https://smithy.io/2.0/guides/smithy-cli/cli_installation.html) (`smithy validate model` in each `packages/*/spec` directory)

## Setup

```bash
bun install
```

Husky installs via `prepare`. **pre-commit** runs `format:check`; **pre-push** runs `format:check`, `typecheck`, and `test`.

## Before you open a PR

From the repo root:

```bash
bun run format:check
bun run typecheck
bun run test
```

If you changed Smithy models (requires [Smithy CLI](https://smithy.io/2.0/guides/smithy-cli/cli_installation.html)):

```bash
bash packages/validate-all.sh
```

Or per package (working directory is `…/spec`):

```bash
smithy validate model && smithy build
```

If you changed public TypeScript APIs, update `CHANGELOG.md` under **Unreleased** (see existing entries for breaking vs additive changes).

## Scope and style

- Match existing patterns in the package you touch; keep diffs focused.
- Use Bun for scripts and tests (`bun test`), not Jest/Vitest.
- Biome handles formatting; the VS Code Biome extension is listed in `.vscode/extensions.json`.
- Do not commit secrets (`.env`, API keys). Do not commit generated `dist/` unless a release workflow requires it.

## Documentation

User-facing docs live in `packages/README.md` and package READMEs. When behavior is normative (Smithy models, persistence, NBC rules), update the relevant spec or guide rather than only inline comments.

## Questions

Open a [GitHub issue](https://github.com/khoralabs/obp/issues) for design questions or bugs. For security issues, see [SECURITY.md](SECURITY.md).
