$version: "2"

namespace khora.obp.frame.relay

use smithy.api#Blob
use smithy.api#Unit

@documentation("""
**Frame relay store** — durable admission secrets and opaque relayed byte spool for hub-mediated channels.

The hub runtime (`@khoralabs/obp-frame-relay`) attaches live peers and fans out bytes; this service models **only** the persistence surface backends must implement. Payload bytes are **opaque** at this layer (relay stamping policy is **`khora.obp.frame.relay#RelayEnvelope`** in the hub runtime).

Reference SQLite table names: `rooms` (channel admission), `room_frames` (relayed byte spool).

**Spool policy (reference TS):** `EnqueueRelayedFrame` applies a per-channel ring buffer (default max 1024 frames / 16 MiB). Oldest frames are dropped when limits are exceeded. Deployments SHOULD run `PurgeExpiredChannels` periodically to reclaim disk for expired admissions.
""")
service FrameRelayStore {
    version: "2026-06-01"
    operations: [
        UpsertChannelAdmission
        GetActiveChannelAdmissionSecret
        EnqueueRelayedFrame
        ListRelayedFramesAfter
        PurgeRelayedFramesForChannel
        DeleteChannelAdmission
        PurgeExpiredChannels
    ]
}

structure ChannelAdmission {
    channel_id: String
    pairing_secret_hex: String
    created_at_ms: Long
    expires_at_ms: Long
}

structure RelayedFrame {
    id: Long
    bytes: Blob
}

list RelayedFrameList {
    member: RelayedFrame
}

structure UpsertChannelAdmissionInput {
    admission: ChannelAdmission
}

structure UpsertChannelAdmissionOutput {}

operation UpsertChannelAdmission {
    input: UpsertChannelAdmissionInput
    output: UpsertChannelAdmissionOutput
}

structure GetActiveChannelAdmissionSecretInput {
    channel_id: String
    now_ms: Long
}

union GetActiveChannelAdmissionSecretResult {
    active: String
    inactive: Unit
}

structure GetActiveChannelAdmissionSecretOutput {
    result: GetActiveChannelAdmissionSecretResult
}

operation GetActiveChannelAdmissionSecret {
    input: GetActiveChannelAdmissionSecretInput
    output: GetActiveChannelAdmissionSecretOutput
}

structure EnqueueRelayedFrameInput {
    channel_id: String
    bytes: Blob
}

structure EnqueueRelayedFrameOutput {
    frame_id: Long
}

operation EnqueueRelayedFrame {
    input: EnqueueRelayedFrameInput
    output: EnqueueRelayedFrameOutput
}

structure ListRelayedFramesAfterInput {
    channel_id: String
    after_frame_id: Long
}

structure ListRelayedFramesAfterOutput {
    frames: RelayedFrameList
}

operation ListRelayedFramesAfter {
    input: ListRelayedFramesAfterInput
    output: ListRelayedFramesAfterOutput
}

structure PurgeRelayedFramesForChannelInput {
    channel_id: String
}

structure PurgeRelayedFramesForChannelOutput {}

operation PurgeRelayedFramesForChannel {
    input: PurgeRelayedFramesForChannelInput
    output: PurgeRelayedFramesForChannelOutput
}

structure DeleteChannelAdmissionInput {
    channel_id: String
}

structure DeleteChannelAdmissionOutput {}

operation DeleteChannelAdmission {
    input: DeleteChannelAdmissionInput
    output: DeleteChannelAdmissionOutput
}

structure PurgeExpiredChannelsInput {
    now_ms: Long
}

structure PurgeExpiredChannelsOutput {
    channels_purged: Integer
}

operation PurgeExpiredChannels {
    input: PurgeExpiredChannelsInput
    output: PurgeExpiredChannelsOutput
}
