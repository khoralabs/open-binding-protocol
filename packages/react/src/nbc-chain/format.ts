export function formatExpiresTurn(n: number): string {
  return n === 0 ? "0 (off)" : String(n);
}

export function formatEpochMs(n: number): string {
  return n === 0 ? "0 (off)" : String(n);
}
