/**
 * `khora.obp.frame.mls#MlsHubEnvelope` (`mls1`) — see packages/frames/spec/model/mls-hub-protocol.smithy
 * MLS wire bytes per RFC 9420 inside `payload`.
 */
export const MLS_HUB_ENVELOPE_VERSION = "mls1" as const;

export type MlsHubEnvelopeV1 = {
  v: typeof MLS_HUB_ENVELOPE_VERSION;
  groupId: string;
  payload: string;
};

export function encodeMlsHubEnvelope(groupId: string, payloadBase64Url: string): Uint8Array {
  const wire: MlsHubEnvelopeV1 = {
    v: MLS_HUB_ENVELOPE_VERSION,
    groupId,
    payload: payloadBase64Url,
  };
  return new TextEncoder().encode(JSON.stringify(wire));
}

export type DecodedMlsHubEnvelope = {
  v: typeof MLS_HUB_ENVELOPE_VERSION;
  groupId: string;
  payloadBase64Url: string;
};

export function decodeMlsHubEnvelope(bytes: Uint8Array): DecodedMlsHubEnvelope | undefined {
  try {
    const text = new TextDecoder().decode(bytes);
    const j = JSON.parse(text) as unknown;
    if (typeof j !== "object" || j === null) return undefined;
    const o = j as Record<string, unknown>;
    if (o.v !== MLS_HUB_ENVELOPE_VERSION) return undefined;
    if (typeof o.groupId !== "string" || o.groupId.length === 0) return undefined;
    if (typeof o.payload !== "string" || o.payload.length === 0) return undefined;
    return {
      v: MLS_HUB_ENVELOPE_VERSION,
      groupId: o.groupId,
      payloadBase64Url: o.payload,
    };
  } catch {
    return undefined;
  }
}
