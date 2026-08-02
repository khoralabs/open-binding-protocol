# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Consolidated workspace into four packages: `@khoralabs/obp-core` (with `./persistence`, `./sqlite`), `@khoralabs/obp-nbc` (with `./bind-policy`), `@khoralabs/obp-wire` (with `./http2`, `./ws`), `@khoralabs/obp-react`.
- Moved theory and Smithy specs under `docs/` (`docs/theory/`, `docs/spec/`); validate with `bash docs/spec/validate.sh`.
- Persistence strategies take an optional `validateBindPolicyAtExpose` hook (NBC supplies the AJV validator) so `obp-core` does not depend on `obp-nbc`.

### Removed

- Separate packages: `obp-errors`, `obp-primitives`, `obp-model`, `obp-byte-stream`, `obp-persistence`, `obp-sqlite-persistence`, `nbc-bind-policy`, `obp-frames-impl`, `obp-session-impl`, `obp-transport-http2`, `obp-transport-ws`, and all `*-spec` npm shells.
