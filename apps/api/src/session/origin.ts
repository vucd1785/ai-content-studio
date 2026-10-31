import { LOOPBACK_HOSTNAMES } from "./constants.js";

/**
 * When Origin is absent (curl, Fastify inject), allow.
 * When present on state-changing requests, require loopback http(s) origin.
 */
export function isAllowedRequestOrigin(origin: string | undefined): boolean {
  if (origin === undefined || origin === "") {
    return true;
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  return LOOPBACK_HOSTNAMES.has(url.hostname);
}
