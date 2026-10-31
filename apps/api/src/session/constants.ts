export const SESSION_COOKIE_NAME = "studio_session";
export const SESSION_TTL_SECONDS = 604_800;
export const SESSION_PAYLOAD_VERSION = 1;

/** Maximum encoded cookie value length (payload + MAC + dot). */
export const MAX_SESSION_COOKIE_VALUE_LENGTH = 4096;

export const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost"]);
