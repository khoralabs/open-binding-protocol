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

This repository provides OBP protocol specifications and reference TypeScript implementations (graph persistence, NBC, frames, session, transports). It does **not** provide end-user authentication or production KMS integration by itself. Hosts remain responsible for protecting persistence backends, transport credentials, and product-specific policy enforcement.

### Frame relay pairing secrets (`rooms.pairing_secret_hex`)

The reference SQLite adapter (`@khoralabs/obp-frame-relay-sqlite`) **encrypts channel pairing secrets at rest** with AES-256-GCM before writing to SQLite. Hosts **must** supply a 32-byte `pairingSecretKey` (from KMS or `OBP_PAIRING_SECRET_ENCRYPTION_KEY`). SQLCipher whole-file encryption is complementary, not a substitute — field encryption limits blast radius when only the DB file is copied without the field key.

Production deployments **should**:

1. Set `OBP_PAIRING_SECRET_ENCRYPTION_KEY` (or pass `pairingSecretKey` from your KMS) when calling `createSqliteFrameRelayStoreStrategy`.
2. Call `restrictRelayStoreDatabasePermissions(dbPath)` so the relay DB, `-wal`, and `-shm` files are owner-only (`0o600`).
3. Rotate or purge expired channels (`purgeExpiredChannels`) so stale admission rows do not accumulate.

Anyone with **both** the database file and the field encryption key can still mint valid tickets for active channels; protect keys separately from backups and restrict process/runtime access.
