export type LlmErrorCode =
  | "schema_invalid"
  | "provider_error"
  | "provider_unavailable"
  | "configuration_missing"
  /** Hết hạn mức gói thuê bao Claude Code: không retry, Director tiếp tục sau khi hạn mức reset. */
  | "quota_exhausted";

export class LlmError extends Error {
  readonly code: LlmErrorCode;

  constructor(code: LlmErrorCode, message: string) {
    super(message);
    this.name = "LlmError";
    this.code = code;
  }
}
