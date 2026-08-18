# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `@khoralabs/obp-nbc`: bilateral snapshot helpers `whoShouldAct` and `availablePortsFor` (empty graph → initiator; otherwise the other party if they still have bindable ports). Not Smithy N1–N9.
- `@khoralabs/obp-nbc`: `getBindablePortsForParty` also filters `bindCount < max_bindings`.
- `@khoralabs/obp-nbc`: host-facing Standard Schema turn profiles (`openingTurnSchema`, `continueTurnSchemaForPorts`, `leaveTurnSchema`) plus `bindPayloadSchemaForPort` — `~standard.validate` and draft-2020-12 `jsonSchema`. Not Zod.
- `@khoralabs/obp-wire`: `FrameSessionHandle.endOffers()` (`END_OFFERS`).
- `@khoralabs/obp-wire`: fire-and-forget `onGraphAdvanced` after a TURN or `END_OFFERS` is applied on the replica.

### Changed

- **Breaking:** Port affordance field is `kind` (not `type`) on `khora.obp#Port`, `NbcPortSpec`, sqlite `obp_ports`, and graph port rows. Parser accepts legacy `type` for one minor unless the value is a JSON Schema keyword (`object|array|string|number|integer|boolean|null`). Missing `kind` is not defaulted. Offer `type` is unchanged. Existing DBs migrate `obp_ports.type` → `kind`.
- Empty-policy bind errors include the port id.
- `expires_at_ms: 0` remains “no wall-clock expiry” (documented in `docs/theory/peer-time.md`). Opening/continue profiles default bind windows to `0`.

### Fixed

- Outbound TURN / `END_OFFERS` apply (TURN) and commit the local DAG tip before send, matching TERMINATE, so sequential sends work on direct transports; inbound echo is skipped via frame dedupe.
- `bindPayloadSchemaForPort` validates active `bind_policy` with AJV. Continue profiles always validate `bind.payload` (omitted payload fails when the policy requires fields).

## [0.1.0] - 2026-08-02

### Changed

- Consolidated workspace into four packages: `@khoralabs/obp-core` (with `./persistence`, `./sqlite`), `@khoralabs/obp-nbc` (with `./bind-policy`), `@khoralabs/obp-wire` (with `./http2`, `./ws`), `@khoralabs/obp-react`.
- Moved theory and Smithy specs under `docs/` (`docs/theory/`, `docs/spec/`); validate with `bash docs/spec/validate.sh`.
- Persistence strategies take an optional `validateBindPolicyAtExpose` hook (NBC supplies the AJV validator) so `obp-core` does not depend on `obp-nbc`.

### Removed

- Separate packages: `obp-errors`, `obp-primitives`, `obp-model`, `obp-byte-stream`, `obp-persistence`, `obp-sqlite-persistence`, `nbc-bind-policy`, `obp-frames-impl`, `obp-session-impl`, `obp-transport-http2`, `obp-transport-ws`, and all `*-spec` npm shells.

[unreleased]: https://github.com/khoralabs/open-binding-protocol/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/khoralabs/open-binding-protocol/releases/tag/v0.1.0
