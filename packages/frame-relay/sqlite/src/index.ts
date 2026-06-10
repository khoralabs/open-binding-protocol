export { restrictRelayStoreDatabasePermissions } from "./db-file-permissions";
export { FrameRelaySqliteError } from "./errors";
export {
  decryptPairingSecretHex,
  encryptPairingSecretHex,
  isEncryptedPairingSecret,
  PAIRING_SECRET_ENVELOPE_ALG,
  PAIRING_SECRET_ENVELOPE_MAGIC,
  PAIRING_SECRET_ENVELOPE_V1,
} from "./pairing-secret-cipher";
export {
  PAIRING_SECRET_ENCRYPTION_KEY_ENV,
  pairingSecretKeyFromEnv,
  pairingSecretKeyFromHex,
  pairingSecretKeyFromUtf8,
  TEST_PAIRING_SECRET_KEY_HEX,
} from "./pairing-secret-key";
export { ensureFrameRelayStoreSchema } from "./schema";
export {
  createSqliteFrameRelayStoreStrategy,
  type SqliteFrameRelayStoreOptions,
} from "./strategy";
