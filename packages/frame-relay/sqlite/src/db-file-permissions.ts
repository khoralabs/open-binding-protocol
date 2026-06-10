import { chmodSync, existsSync } from "node:fs";

/** Restrict relay SQLite file (+ WAL/SHM siblings) to owner read/write (0o600). */
export function restrictRelayStoreDatabasePermissions(dbPath: string): void {
  if (dbPath === ":memory:") {
    return;
  }
  for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (existsSync(path)) {
      chmodSync(path, 0o600);
    }
  }
}
