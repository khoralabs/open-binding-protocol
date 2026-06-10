# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `@khoralabs/obp-primitives`: shared hex encoding, SHA-256 helpers, and `Sha256HexLower` wire type.
- Initial open-source release of the OBP monorepo: Smithy specs and TypeScript reference implementations for model, persistence, NBC, frames, session, transports, frame relay, and React visualization.
- `@khoralabs/nbc-bind-policy`: JSON Schema (draft 2020-12) + AJV validation for NBC bind payloads.
- `@khoralabs/duplex-byte-stream`: duplex byte streams and channel admission tickets for relay transports.
- OSS docs: `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`.

### Changed

- `JsonDocument` is owned only by `@khoralabs/obp-model`; duplicate defs removed from frames/session packages.

### Removed

- `@khoralabs/obp-frames-impl` no longer re-exports `JsonDocument`, `Sha256HexLower`, `isSha256HexLower`, `toSha256HexLower`, or `sha256HexLowerFromUtf8String` — import from `@khoralabs/obp-model` / `@khoralabs/obp-primitives`.
- `@khoralabs/obp-session-impl` no longer re-exports `JsonDocument`, `Sha256HexLower`, `isSha256HexLower`, or `toSha256HexLower`.
