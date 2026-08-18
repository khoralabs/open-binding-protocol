# `@khoralabs/obp-wire`

OBP frame and session wire protocol, plus transports.

```ts
import { /* frame / session APIs */ } from "@khoralabs/obp-wire";
import { /* HTTP/2 connect / serve */ } from "@khoralabs/obp-wire/http2";
import { /* WebSocket transport */ } from "@khoralabs/obp-wire/ws";
```

Depends on `@khoralabs/obp-core` and `@khoralabs/obp-nbc`.

`FrameSessionHandle.endOffers()` emits `END_OFFERS`. `onGraphAdvanced` fires after a TURN or `END_OFFERS` is applied on the replica (inbound; relay echo covers local TURNs).
