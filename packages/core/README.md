# `@khoralabs/obp-core`

Foundation types and graph persistence.

```ts
import { ObpError, type Party } from "@khoralabs/obp-core";
import { createInMemoryObpPersistenceClient } from "@khoralabs/obp-core/persistence";
import { createObpSqlitePersistenceClient, openObpDatabase } from "@khoralabs/obp-core/sqlite";
```

Pass `validateBindPolicyAtExpose` from `@khoralabs/obp-nbc` when NBC expose-time schema checks are required.
