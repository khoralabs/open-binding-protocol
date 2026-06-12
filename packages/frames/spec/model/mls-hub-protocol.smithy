$version: "2"

namespace khora.obp.frame.mls

@documentation("""
**MLS hub blob-bus profile — transport confidentiality for hub-mediated byte streams.**

This namespace defines the **outer** wire envelope for crypto-blind blob hubs that forward opaque WebSocket (or equivalent) bytes without parsing **`khora.obp.frame#Frame`** DAG fields. Message-layer security uses **Messaging Layer Security (MLS)** per **RFC 9420**. HPKE details per **RFC 9180**. Agent credential signature keys use **Ed25519** per **RFC 8032**. The JSON envelope uses **RFC 8259**.

**Not part of core `khora.obp.frame`:** Inner negotiation semantics remain **`khora.obp.frame#NegotiationFrameProtocol`** (length-prefixed multiplex with logical plaintext **`Frame.body`**). This profile wraps those bytes inside MLS **`payload`** after group encryption.

**MLS cryptographic profile (normative constants):**
- Ciphersuite identifier **0x0001** (**RFC 9420**): `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`
- Group bootstrap: **RFC 9420** KeyPackage publication, Welcome, Commit, Proposal, and Application message processing
- **`groupId`** on this envelope **MUST** equal the bilateral NBC **`session_id`** when carrying multiplex negotiation for that session

**Client integration (informative):** Deployments **MUST NOT** combine this profile with deprecated frame-channel body encryption (`e2ee` / `e2ee_hs` on **`Frame.body`**). Choose MLS hub wrapping **or** custodial plaintext on the blob bus at integration time — not in-band negotiation on the bus.

**Hub blob-bus rules (crypto-blind forwarder):**
- Blobs decode as **`MlsHubEnvelope`** with **`v = mls1`** are forwarded opaque to all connected peers **including the sender** (echo).
- The hub **MUST NOT** decrypt MLS **`payload`** or parse inner OBP frames.

**Peer timing:** MLS application payloads carry **`RelayTimingFrame`** (`rt1`) inside MLS encryption. Wall-clock bind windows use **`expires_at_ms`** + HLC peer time (`khora.obp.nbc.clock`).

**Client send rules:**
- After MLS decrypt, the inner byte stream is a **`RelayTimingFrame`**; bare OBP multiplex follows timing unwrap.
- Inner negotiation uses **`khora.obp.frame#NegotiationFrameProtocol`** multiplex; bare **`Frame`** objects on the inner stream.

**HTTP KeyPackage / Welcome publication** for MLS bootstrap uses **RFC 9420** wire formats; URL layout is deployment-specific and **not** defined in this namespace.
""")
enum MlsHubEnvelopeVersion {
    /// Profile version label for **`MlsHubEnvelope`** (not an RFC term).
    mls1
}

/// Outer JSON object on the blob bus when the MLS hub profile is in use.
structure MlsHubEnvelope {
    /// Profile version; **`mls1`** for this revision.
    v: MlsHubEnvelopeVersion
    /// MLS group identifier; **MUST** equal bilateral **`session_id`** for NBC multiplex over this group.
    groupId: String
    /// Base64url-encoded MLS wire bytes per **RFC 9420** (application message, commit, proposal, etc.).
    payload: String
}
