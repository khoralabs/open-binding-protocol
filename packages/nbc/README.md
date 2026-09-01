# `@khoralabs/obp-nbc`

Negotiated Binding Convention (NBC) rules for OBP.

```ts
import {
  availablePortsFor,
  bindPayloadSchemaForPort,
  continueTurnSchemaForPorts,
  leaveTurnSchema,
  openingTurnSchema,
  whoShouldAct,
} from "@khoralabs/obp-nbc";
import { validateNbcBindPayloadForPort } from "@khoralabs/obp-nbc/bind-policy";
```

Host-facing turn profiles (`opening` / `continue` / `leave`) are [Standard Schema](https://standardschema.dev) (`~standard.validate` + `~standard.jsonSchema` draft-2020-12), not Zod. Wire remains `NbcTurnBody`.

Bilateral helpers `whoShouldAct` / `availablePortsFor` are a documented ping-pong profile on `NbcChainGraph` — not Smithy N1–N9. Empty graph → initiator; otherwise the party who did not extend the last offer, if they still have bindable ports.

`expires_at_ms: 0` means no wall-clock expiry.

Depends on `@khoralabs/obp-core`.
