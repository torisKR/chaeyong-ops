import { timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "career_ops_session";

// The launcher creates a fresh 256-bit secret for each server lifetime. Unlike
// Host/Origin, possession of this secret cannot be forged by a LAN HTTP client.
export function validSessionSecret(secret) {
  return typeof secret === "string" && /^[a-f0-9]{64}$/.test(secret);
}

export function matchesSession(candidate, secret) {
  if (!validSessionSecret(secret) || !validSessionSecret(candidate)) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(secret));
}

export function sessionAuthorized({ cookie, authorization, secret }) {
  if (authorization?.startsWith("Bearer ") && matchesSession(authorization.slice(7), secret)) return true;
  return matchesSession(cookie, secret);
}
