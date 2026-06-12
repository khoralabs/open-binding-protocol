# Security policy

## Supported versions

Security fixes are applied to the latest release on the default branch. Older major/minor lines may not receive backports unless noted in release notes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

1. Use [GitHub private vulnerability reporting](https://github.com/khoralabs/obp/security/advisories/new) for this repository, if enabled, **or**
2. Contact the maintainers through your organization's usual secure channel if you are an internal contributor.

Include:

- A clear description of the issue and impact
- Steps to reproduce or a minimal proof of concept
- Affected package versions and commit SHA if known

We aim to acknowledge reports within a few business days and will coordinate disclosure timing with you.

## Scope notes

This repository provides OBP protocol specifications and reference TypeScript implementations (graph persistence, NBC, frames, session, transports). It does **not** provide end-user authentication, relay channel admission, or production KMS integration by itself. Hosts remain responsible for protecting persistence backends, transport credentials, and product-specific policy enforcement.

**Transport confidentiality:** OBP `Frame.body` is logical plaintext at the protocol layer. Internet deployments should use the MLS hub profile (`khora.obp.frame.mls`, RFC 9420) documented in `packages/frames/spec/model/mls-hub-protocol.smithy` and `packages/frames/impl/ts/docs/TRANSPORT_CONFIDENTIALITY.md`. Custodial plaintext and TLS-only direct transports are separate documented profiles.

**Relay security** (channel pairing secrets, WebSocket admission, spool): see the relay repository `SECURITY.md`.
