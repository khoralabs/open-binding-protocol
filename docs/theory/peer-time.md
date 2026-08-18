# NBC peer time (HLC + NTP skew)

Wall-clock bind windows use **`expires_at_ms`** evaluated with peer-derived HLC time (`effective_now_ms`) — not hub-stamped relay time.

## Modes (N1)

| Field | Evaluation |
|-------|------------|
| `expires_turn` | Bindable when `expires_turn === 0` (disabled) or `turn_seq < expires_turn` |
| `expires_at_ms` | Bindable when `expires_at_ms === 0` (no wall-clock expiry) or `effective_now_ms < expires_at_ms` (HLC) |

## HLC

See `khora.obp.nbc.clock`. Relay client maintains HLC state in `RelayTimingFrame` (`rt1`). OBP receives `getEffectiveNowMs()` / `getCurrentHlc()` callbacks.

## Skew estimation

RFC 5905 §8 offset formula adapted to one-way samples: `offset ≈ recv_ms - peer_pt` averaged over observations.

## Fail-closed policy

- `MIN_SAMPLES = 1`
- `MAX_SKEW_MS = 30000`
- If `effective_now_ms` is unavailable, epoch mode binds are rejected.

## TURN `clock` block

Offer-bearing TURNs may embed `clock: { hlc, observed? }` in signed `Frame.body` for DAG auditability.

## n > 2 groups

Documented expansion path in `nbc-clock.smithy` and relay `peer-timing.md`.
