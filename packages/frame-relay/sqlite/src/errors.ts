export class FrameRelaySqliteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrameRelaySqliteError";
  }
}
