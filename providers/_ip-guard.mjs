// Reject a connection whose resolved address is not a public one (#3096).
//
// Every provider's host guard pins the HOSTNAME to a public registrable
// domain, but nothing checked where that name RESOLVES. A hostname with an A
// record pointing at 127.0.0.1, 169.254.169.254 (cloud metadata) or an RFC1918
// range was connected to normally. `redirect: 'error'` blocks redirect-based
// hops; it does not block a direct malicious record.
//
// WHY THE CHECK IS SCOPED, NOT GLOBAL. _dns-cache.mjs patches `dns.lookup` on
// the node:dns module object, which is process-wide. Rejecting private ranges
// there unconditionally would reject every loopback connection anything in the
// process makes — measured, Node calls dns.lookup even for a numeric host:
//
//     fetch('http://127.0.0.1:PORT')  -> dns.lookup calls: 1
//     fetch('http://localhost:PORT')  -> dns.lookup calls: 2
//
// In this repo that is already 10+ test files that stand up a local HTTP
// server and fetch it. An env opt-out would have fixed the suite by disabling
// the guard exactly where it is most likely to regress, so instead
// providers/_http.mjs marks its own requests with the AsyncLocalStorage below
// and the patched lookup validates only inside that context.
//
// WHY AT LOOKUP TIME. The address validated has to be the address dialled, or
// a name that answers public-then-private (DNS rebinding) slips through a
// pre-flight check. `net.connect` reads `dns.lookup` at call time and connects
// to what it returns, so validating in the lookup closes that window without
// an undici Agent — and undici is not a dependency of this project.

import { AsyncLocalStorage } from 'node:async_hooks';
import { isIP } from 'node:net';

/**
 * Set while a provider HTTP request is in flight. The patched dns.lookup
 * validates resolved addresses only when this is entered, so loopback stays
 * usable everywhere else in the process.
 *
 * @type {AsyncLocalStorage<{ url: string }>}
 */
export const providerFetchContext = new AsyncLocalStorage();

/** Is a provider request in flight on this async path? */
export function inProviderFetch() {
  return providerFetchContext.getStore() !== undefined;
}

/**
 * IPv4 ranges that must never be dialled by a provider.
 *
 * 169.254.0.0/16 is the one with teeth: 169.254.169.254 is the cloud instance
 * metadata endpoint on AWS/GCP/Azure, so it is the address an SSRF is usually
 * aimed at. The rest are the ordinary private/loopback/reserved space.
 *
 * @type {[number, number][]} [network, prefixLength]
 */
const V4_BLOCKED = [
  [0x00000000, 8],   // 0.0.0.0/8      "this network"
  [0x0A000000, 8],   // 10.0.0.0/8     RFC1918
  [0x64400000, 10],  // 100.64.0.0/10  CGNAT
  [0x7F000000, 8],   // 127.0.0.0/8    loopback
  [0xA9FE0000, 16],  // 169.254.0.0/16 link-local + cloud metadata
  [0xAC100000, 12],  // 172.16.0.0/12  RFC1918
  [0xC0000000, 24],  // 192.0.0.0/24   IETF protocol assignments
  [0xC0A80000, 16],  // 192.168.0.0/16 RFC1918
  [0xC6120000, 15],  // 198.18.0.0/15  benchmarking
  [0xE0000000, 4],   // 224.0.0.0/4    multicast
  [0xF0000000, 4],   // 240.0.0.0/4    reserved (includes 255.255.255.255)
];

/** Dotted-quad -> uint32, or null when it is not a well-formed IPv4 literal. */
function v4ToInt(address) {
  const parts = String(address).split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    // Canonical decimal octets only. A leading zero is rejected because
    // `0177.0.0.1` is octal for 127.0.0.1 in some parsers, and a form this
    // function reads as public while a connector reads as loopback is the
    // whole bypass. dns.lookup never emits a non-canonical quad, so this is
    // defence in depth rather than a live path — which is the right default
    // for a function whose job is to say "safe".
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/**
 * Does this address belong to a range a provider must never connect to?
 *
 * Accepts both families. An IPv4-mapped or IPv4-compatible IPv6 address is
 * unwrapped and judged as IPv4 — `::ffff:127.0.0.1` is loopback however it is
 * spelled, and treating the two spellings differently is the bypass.
 *
 * @param {string} address - Resolved IP literal, as dns.lookup returns it.
 * @returns {boolean} True when the address is private/loopback/reserved.
 */
export function isBlockedAddress(address) {
  const raw = String(address ?? '').trim();
  if (!raw) return true; // nothing to validate is not the same as safe

  // Parse addresses before applying ranges. Prefix regexes miss expanded
  // loopback/mapped addresses and accepting malformed IPv6 is unsafe.
  const addr = raw.split('%')[0].toLowerCase();
  const family = isIP(addr);
  if (!family) return true;
  if (family === 4) {
    const value = v4ToInt(addr);
    return value === null || V4_BLOCKED.some(([net, bits]) => {
      const mask = (0xFFFFFFFF << (32 - bits)) >>> 0;
      return ((value & mask) >>> 0) === net;
    });
  }

  let hex = addr;
  if (hex.includes('.')) {
    const split = hex.lastIndexOf(':');
    const embedded = v4ToInt(hex.slice(split + 1));
    if (embedded === null) return true;
    hex = hex.slice(0, split + 1) + `${(embedded >>> 16).toString(16)}:${(embedded & 0xffff).toString(16)}`;
  }
  const halves = hex.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
  const words = [...left, ...Array(8 - left.length - right.length).fill('0'), ...right].map(part => parseInt(part, 16));
  // Mapped and compatible addresses must inherit their IPv4 verdict, including
  // fully expanded spellings such as 0:0:0:0:0:ffff:7f00:1.
  if (words.slice(0, 5).every(word => word === 0) && (words[5] === 0xffff || words[5] === 0)) {
    return isBlockedAddress(`${words[6] >>> 8}.${words[6] & 255}.${words[7] >>> 8}.${words[7] & 255}`);
  }
  // Only global unicast is dialable. This rejects ULA (fc00::/7), all
  // fe80::/10 spellings, multicast, NAT64 and special/reserved address space.
  if ((words[0] & 0xe000) !== 0x2000) return true;
  if (words[0] === 0x2002) return true; // 6to4 may encapsulate a private IPv4
  if (words[0] === 0x2001 && (words[1] < 0x0200 || words[1] === 0x0db8)) return true;
  return false;
}

/**
 * The error a blocked lookup fails with.
 *
 * Carries a `code` so it reads like any other DNS failure to callers that
 * branch on one, and is deliberately NOT in RESOLVER_FAILURE_CODES — this is a
 * verdict about one hostname, not a sick resolver, so it must not be
 * negative-cached as resolver health nor counted toward a resolver-outage
 * signal.
 *
 * @param {string} hostname - The name that resolved.
 * @param {string} address - The address it resolved to.
 * @returns {Error}
 */
export function blockedAddressError(hostname, address) {
  const err = new Error(
    `Refusing to connect to ${hostname}: resolves to non-public address ${address}`,
  );
  /** @type {any} */ (err).code = 'ECAREEROPS_BLOCKED_ADDRESS';
  /** @type {any} */ (err).hostname = hostname;
  /** @type {any} */ (err).address = address;
  return err;
}
