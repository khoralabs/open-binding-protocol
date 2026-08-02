# Transport confidentiality (OBP frame channel)

Normative wire shapes: `docs/spec/frame/mls-hub-protocol.smithy` (`khora.obp.frame.mls`).

Relay deployment (admission, spool, fan-out): relay repo `docs/channel-persistence.md`.

Cryptographic standards:

- [RFC 9420](https://www.rfc-editor.org/rfc/rfc9420) — Messaging Layer Security (MLS)
- [RFC 9180](https://www.rfc-editor.org/rfc/rfc9180) — HPKE
- [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032) — Ed25519 credentials
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) — JSON (`MlsHubEnvelope`)

At the OBP layer, `Frame.body` is always **logical plaintext**. `sig` is over logical `signing_bytes`. Confidentiality is provided by the transport profile below, not by encrypting `body` inside `khora.obp.frame`.

## Profiles

| Profile | Outer bytes | OBP inner | Wall-clock NBC N1 |
|---------|-------------|-----------|-------------------|
| MLS blob-hub (internet default) | `khora.obp.frame.mls#MlsHubEnvelope` (`v: mls2`) | `RelayTimingFrame` (`rt1`) then multiplex | `expires_at_ms` + HLC peer time |
| Custodial plaintext | `RelayTimingFrame` (`rt1`) then multiplex | Bare `Frame` | `expires_at_ms` + HLC peer time |
| Direct HTTP2 / TLS | Plain multiplex | Bare `Frame` | Causal (`expires_turn`) or local policy |

Deployments choose MLS-wrapped vs plaintext at **integration time**. There is no in-band capability negotiation on the bus.

## MLS blob-hub profile (`khora.obp.frame.mls`)

**Ciphersuite (RFC 9420):** `0x0001` — `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`

**Outer envelope (`mls2`):**

```json
{ "v": "mls2", "route": "<opaque handle>", "payload": "<base64url MLS wire bytes>" }
```

**Inner timing (`rt1`):** After MLS decrypt, bytes are `RelayTimingFrame` with HLC stamp and base64url application body (multiplex). See relay `docs/peer-timing.md`.

**Bootstrap (RFC 9420):** KeyPackage publication, Welcome (includes opaque `route`), group join. NBC `session_id` is exchanged on DID-signed Welcome HTTP only.

**NBC on MLS profile:** Use `expires_at_ms` with peer HLC timing (`khora.obp.nbc.clock`).

**Inner stream:** After timing unwrap, bytes follow `khora.obp.frame#NegotiationFrameProtocol`. **Do not** combine with deprecated frame-channel `e2ee` / `e2ee_hs` on `Frame.body`.

### Threat model (MLS hub)

**Relay-visible:** opaque `route`, blob sizes, timing envelope metadata (HLC physical component).

**Peer-only:** MLS `payload` plaintext (multiplex wire, NBC semantics in `TURN.body`).

## Custodial plaintext

Relay forwards `RelayTimingFrame` (`rt1`) without MLS. NBC bodies are visible to the relay operator. Peer epoch timing still applies inside `rt1`. Relay does not wrap bare `Frame` in an envelope.

## Direct transport

TLS (or local trust) protects the byte stream. No OBP-layer body encryption.
