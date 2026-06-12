$version: "2"

namespace khora.obp.nbc.clock

@documentation("""
**Peer logical clock** for NBC epoch bind windows (`expires_at_ms`).

Uses Hybrid Logical Clocks (Kulkarni & Demirbas 2014) with millisecond physical component **`pt`** and logical counter **`lc`**.

**Merge rule (inbound):** `pt = max(local.pt, msg.pt, wall_ms)`. If `pt == local.pt && pt == msg.pt`, `lc = max(local.lc, msg.lc) + 1`; else if `pt == local.pt`, `lc = local.lc + 1`; else if `pt == msg.pt`, `lc = msg.lc + 1`; else `lc = 0`.

**Send rule (outbound):** `pt = max(local.pt, wall_ms)`. If `pt == local.pt`, `lc = local.lc + 1`; else `lc = 0`.

**N1 effective-now:** binder computes `effective_now_ms` from merged HLC state and peer observation samples using conservative evaluation (fail closed when sample count < `MIN_SAMPLES` or estimated skew > `MAX_SKEW_MS`).

**n > 2 expansion (future):** multi-member groups will carry multiple `observed` samples per frame; N-way HLC merge is additive.
""")
structure HlcTimestamp {
    pt: Long
    lc: Integer
}

structure ClockObservation {
    p_hash: String
    peer_actor: String
    peer_pt: Long
    recv_ms: Long
}

structure ClockBlock {
    hlc: HlcTimestamp
    observed: ClockObservation
}
