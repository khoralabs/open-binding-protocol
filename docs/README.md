# OBP documentation

- **[Theory](theory/)** — narrative overview, layering, peer time, transport confidentiality
- **[Spec](spec/)** — normative Smithy models (`khora.obp`, NBC, frame, session, transport)

Validate specs:

```sh
bash docs/spec/validate.sh
```

Requires the [Smithy CLI](https://smithy.io/2.0/guides/smithy-cli/cli_installation.html).

## Packages

| Package | Role |
|---------|------|
| `@khoralabs/obp-core` | Foundation + graph store (`./persistence`, `./sqlite`) |
| `@khoralabs/obp-nbc` | Convention layer + bind-policy validators |
| `@khoralabs/obp-wire` | Frame/session runtime + transport bindings (`./http2`, `./ws`) |
| `@khoralabs/obp-react` | Optional UI |
