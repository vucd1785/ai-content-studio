export type LlmErrorCode =
  | "schema_invalid"
  | "provider_error"
  | "provider_unavailable"
  | "configuration_missing";

export class LlmError extends Error {
  readonly code: LlmErrorCode;

  constructor(code: LlmErrorCode, message: string) {
    super(message);
    this.name = "LlmError";
    this.code = code;
  }
}
