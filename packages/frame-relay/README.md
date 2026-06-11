# OBP frame relay (contract only)

Smithy specification for ticket-gated hub relay of OBP negotiation byte streams. The in-process TypeScript implementation (`@khoralabs/obp-frame-relay`) and SQLite store (`@khoralabs/obp-frame-relay-sqlite`) were removed; deployable relay lives in the **relay** repo (`relay-server-http`).

## Layout

| Path | Package |
|------|---------|
| `spec/model/` | `@khoralabs/obp-frame-relay-spec` — `RelayEnvelope` wire policy + `FrameRelayStore` persistence service |

## Admission tickets

Channel admission (HMAC tickets, WS upgrade nonces, `relay_rooms` persistence) lives in `@khoralabs/relay-admission`. Pairing-secret field encryption lives in `@khoralabs/relay-crypto`. Join proofs are HMAC-SHA256 v1 tickets (`v1:{"cid","exp",...}`): `signChannelTicket`, `verifyChannelTicket`, `generateChannelSecretHex`.

Future work: thin `@khoralabs/obp-relay-adapter` mapping this Smithy contract onto `relay-server-http`.
