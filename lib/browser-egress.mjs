// Chromium must never choose the address it dials. Routing hooks do not see
// every redirect and a DNS preflight cannot constrain Chromium's own resolver.
// A loopback SOCKS5 tunnel resolves, checks ALL answers and dials one checked
// literal; the browser keeps HTTP Host, TLS/SNI, cookies and redirect semantics.
import net from 'node:net';
import dns from 'node:dns/promises';
import { isBlockedAddress } from '../providers/_ip-guard.mjs';

export const BROWSER_EGRESS_LAUNCH_OPTIONS = Object.freeze({ args: [
  '--enable-automation', '--disable-quic', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
] });
const guardedContexts = new WeakMap();
const verifiedBrowsers = new WeakSet();
async function requireProtectedBrowser(browser) {
  if (verifiedBrowsers.has(browser) || typeof browser.newBrowserCDPSession !== 'function') return;
  const session = await browser.newBrowserCDPSession();
  try {
    const { arguments: args } = await session.send('Browser.getBrowserCommandLine');
    const policies = (args ?? []).filter(flag => flag.startsWith('--force-webrtc-ip-handling-policy='));
    if (!BROWSER_EGRESS_LAUNCH_OPTIONS.args.every(flag => args?.includes(flag)) || args.includes('--enable-quic') || policies.at(-1) !== '--force-webrtc-ip-handling-policy=disable_non_proxied_udp') {
      throw new Error('Browser must disable QUIC and non-proxied WebRTC UDP before opening guarded contexts');
    }
    verifiedBrowsers.add(browser);
  } finally { await session.detach(); }
}
const normalizeHost = value => {
  const host = String(value).toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  // SOCKS carries expanded IPv6 bytes; Playwright URLs use compressed text.
  return net.isIP(host) === 6 ? new URL(`http://[${host}]/`).hostname.slice(1, -1) : host;
};
async function resolveViaDns(host) {
  const answers = await Promise.all([
    dns.resolve4(host).catch(() => []), dns.resolve6(host).catch(() => []),
    dns.lookup(host, { all: true }).then(rows => rows.map(row => row.address)).catch(() => []),
  ]);
  return [...new Set(answers.flat())];
}
let hostResolver = resolveViaDns;
export function setHostResolver(resolver) {
  const previous = hostResolver;
  hostResolver = resolver ?? resolveViaDns;
  return () => { hostResolver = previous; };
}
function securityError(message, code = 'blocked_host') {
  return Object.assign(new Error(message), { livenessCode: code });
}
export function rejectPrivateOrInvalid(value) {
  let url;
  try { url = new URL(value); } catch { return { code: 'invalid_url', reason: 'invalid URL' }; }
  if (!['http:', 'https:'].includes(url.protocol)) return { code: 'unsupported_protocol', reason: `unsupported protocol ${url.protocol}` };
  const host = normalizeHost(url.hostname);
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'localhost.localdomain' || (net.isIP(host) && isBlockedAddress(host))) {
    return { code: 'blocked_host', reason: `blocked host ${url.hostname}` };
  }
  return null;
}
async function resolvePublicAddresses(hostname, resolver = hostResolver) {
  const host = normalizeHost(hostname);
  const literalVerdict = rejectPrivateOrInvalid(`http://${net.isIP(host) === 6 ? `[${host}]` : host}/`);
  if (literalVerdict) throw securityError(literalVerdict.reason);
  // No preflight cache: each new TCP connection revalidates its actual answers.
  const addresses = net.isIP(host) ? [host] : await resolver(host);
  if (!Array.isArray(addresses) || !addresses.length) throw securityError(`DNS resolution returned no addresses for ${host}`, 'dns_no_addresses');
  for (const address of addresses) {
    if (isBlockedAddress(address)) throw securityError(`Access denied: Egress guard blocked private target IP ${address}`);
  }
  return addresses;
}
export async function validateUrlSecurity(value) {
  const verdict = rejectPrivateOrInvalid(value);
  if (verdict) throw securityError(verdict.reason, verdict.code);
  return resolvePublicAddresses(new URL(value).hostname);
}

// Injection is an in-process test seam, never an environment or CLI opt-out.
// The connector is called only AFTER all resolver answers passed validation.
export async function createBrowserEgress({ resolveHost, connect = options => net.connect(options) } = {}) {
  const sockets = new Set();
  const failures = new Map();
  const server = net.createServer(client => {
    sockets.add(client);
    client.on('error', () => {});
    client.on('close', () => sockets.delete(client));
    client.setTimeout(30_000, () => client.destroy());
    let bytes = Buffer.alloc(0), stage = 'greeting', upstream;
    const fail = code => { if (!client.destroyed) client.end(Buffer.from([5, code, 0, 1, 0, 0, 0, 0, 0, 0])); };
    const consume = async () => {
      if (stage === 'greeting') {
        if (bytes.length < 2 || bytes.length < 2 + bytes[1]) return;
        if (bytes[0] !== 5 || !bytes.subarray(2, 2 + bytes[1]).includes(0)) { client.end(Buffer.from([5, 255])); return; }
        bytes = bytes.subarray(2 + bytes[1]); stage = 'request'; client.write(Buffer.from([5, 0]));
      }
      if (stage !== 'request' || bytes.length < 5) return;
      const type = bytes[3];
      const addressBytes = type === 1 ? 4 : type === 4 ? 16 : type === 3 ? bytes[4] + 1 : 0;
      if (!addressBytes || bytes[0] !== 5 || bytes[1] !== 1) { stage = 'closed'; fail(7); return; }
      if (bytes.length < 4 + addressBytes + 2) return;
      const host = type === 1 ? [...bytes.subarray(4, 8)].join('.') : type === 3
        ? bytes.subarray(5, 4 + addressBytes).toString('utf8')
        : Array.from({ length: 8 }, (_, i) => bytes.readUInt16BE(4 + i * 2).toString(16)).join(':');
      const port = bytes.readUInt16BE(4 + addressBytes);
      const pending = bytes.subarray(6 + addressBytes);
      stage = 'connecting';
      client.pause();
      try {
        const addresses = await resolvePublicAddresses(host, resolveHost ?? hostResolver);
        if (client.destroyed) return;
        // A public host may publish an unreachable first address. Try the
        // remaining answers, still dialing only already-validated literals.
        for (const address of addresses) {
          if (client.destroyed) return;
          try {
            upstream = await new Promise((resolve, reject) => {
              const socket = connect({ host: address, family: net.isIP(address), port });
              sockets.add(socket);
              socket.on('close', () => sockets.delete(socket));
              socket.on('error', () => {});
              const cleanup = () => {
                clearTimeout(timer);
                socket.removeListener('error', failed);
                socket.removeListener('connect', connected);
                socket.removeListener('close', cancelled);
              };
              const failed = error => { cleanup(); socket.destroy(); reject(error); };
              const connected = () => { cleanup(); resolve(socket); };
              const cancelled = () => failed(new Error('Proxy closed before the connection completed'));
              const timer = setTimeout(() => failed(new Error('Proxy connection timed out')), 10_000);
              socket.once('error', failed);
              socket.once('connect', connected);
              socket.once('close', cancelled);
            });
            break;
          } catch { /* next validated address */ }
        }
        if (!upstream || client.destroyed) { upstream?.destroy(); fail(5); client.resume(); return; }
        upstream.on('error', () => { fail(5); client.destroy(); });
        upstream.setTimeout(30_000, () => upstream.destroy());
        stage = 'tunnel'; client.removeListener('data', onData);
        client.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]));
        if (pending.length) upstream.write(pending);
        client.pipe(upstream); upstream.pipe(client); client.resume();
        client.once('close', () => upstream.destroy());
      } catch (error) {
        failures.set(normalizeHost(host), error); stage = 'closed'; fail(2); client.resume();
      }
    };
    function onData(chunk) {
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.length > 64 * 1024) { client.destroy(); return; }
      consume().catch(() => client.destroy());
    }
    client.on('data', onData);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  let closing;
  return {
    proxy: { server: `socks5://127.0.0.1:${server.address().port}`, bypass: '<-loopback>' },
    failures,
    clearFailures() { failures.clear(); },
    close() {
      return closing ??= new Promise(resolve => { for (const socket of sockets) socket.destroy(); server.close(resolve); });
    },
  };
}

export function isGuardedContext(context) { return guardedContexts.has(context); }
export function resetPageEgress(page) {
  if (typeof page?.context === 'function') guardedContexts.get(page.context())?.clearFailures();
}
export async function closeGuardedBrowserContext(context) {
  try { await context.close?.(); }
  finally { await guardedContexts.get(context)?.close(); }
}
function markBlocked(page, request, error) {
  const canTell = typeof request?.isNavigationRequest === 'function' && typeof request?.frame === 'function' && typeof page?.mainFrame === 'function';
  const main = canTell ? request.isNavigationRequest() && request.frame() === page.mainFrame() : true;
  if (page && (error.livenessCode !== 'dns_no_addresses' || main)) {
    page._blockedByGuard = { code: 'blocked_host', reason: error.message };
  }
}
export async function installBrowserRequestGuard(context) {
  // A route hook alone cannot secure a real context. Refuse accidental reuse
  // unless the context was constructed with our connection proxy.
  if (typeof context.browser === 'function' && !isGuardedContext(context)) throw new Error('Browser context has no enforced egress proxy');
  await context.route('**/*', async route => {
    const request = route.request();
    let page;
    try { page = request.frame?.().page?.(); } catch { /* service worker */ }
    try {
      await validateUrlSecurity(request.url());
      return route.continue();
    } catch (error) {
      markBlocked(page, request, error);
      return route.abort('blockedbyclient');
    }
  });
}
export async function newGuardedBrowserContext(browser, options = {}, egressOptions) {
  await requireProtectedBrowser(browser);
  const egress = await createBrowserEgress(egressOptions);
  let context;
  try {
    context = await browser.newContext({ ...options, proxy: egress.proxy, serviceWorkers: 'block' });
    guardedContexts.set(context, egress);
    context.on?.('requestfailed', request => {
      try {
        const failure = egress.failures.get(normalizeHost(new URL(request.url()).hostname));
        if (failure) markBlocked(request.frame().page(), request, failure);
      } catch { /* detached frames */ }
    });
    const closed = () => { void egress.close(); };
    context.once?.('close', closed);
    browser.once?.('disconnected', closed);
    // Also cover minimal browser test doubles and awaited explicit teardown.
    if (typeof context.close === 'function') {
      const originalClose = context.close.bind(context);
      context.close = async (...args) => {
        try { return await originalClose(...args); }
        finally { browser.removeListener?.('disconnected', closed); await egress.close(); }
      };
    }
    await installBrowserRequestGuard(context);
    return context;
  } catch (error) {
    try { await context?.close?.(); } finally { await egress.close(); }
    throw error;
  }
}
