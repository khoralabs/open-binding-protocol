/**
 * Apply **`NbcTurnBody`** from a negotiation **TURN** frame through **`ObpPersistenceClient`**
 * (same steps as {@link applyNbcTurn}).
 */

import type { ObpPersistenceClient } from "@khoralabs/obp-core/persistence";
import type { NbcBindTiming } from "./nbc-invariants";
import { type ApplyNbcTurnParams, type ApplyNbcTurnResult, applyNbcTurn } from "./nbc-turn";
import { type NbcTurnBody, parseNbcTurnBody } from "./nbc-types";

export type ApplyNbcFrameTurnResult = ApplyNbcTurnResult;

/** Parse `Frame.body` (record-shaped JSON) into **`NbcTurnBody`**. */
export function parseNbcFrameTurnBody(body: Record<string, unknown>): NbcTurnBody {
  return parseNbcTurnBody(body);
}

export async function applyNbcFrameTurn(
  client: ObpPersistenceClient,
  partyId: string,
  body: NbcTurnBody,
  timing: NbcBindTiming,
  validateBindPayload?: ApplyNbcTurnParams["validateBindPayload"],
): Promise<ApplyNbcFrameTurnResult> {
  return applyNbcTurn({ partyId, body, client, timing, validateBindPayload });
}
