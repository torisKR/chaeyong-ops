/**
 * Shared JSON POST for incoming-webhook notifiers.
 * Never logs the URL — Slack/Discord/Telegram secrets live in the path.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * POST a JSON body. `fetchImpl` is injectable for tests.
 *
 * @param {string} url
 * @param {object} body
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, headers?: Record<string, string> }} [opts]
 * @returns {Promise<{ ok: boolean, status: number, error?: string }>}
 */
export async function postJson(url, body, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return { ok: false, status: 0, error: 'fetch is not available in this Node runtime' };
  }
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    return { ok: false, status: 0, error: 'refusing non-https webhook URL' };
  }
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const headers = { 'content-type': 'application/json', ...(opts.headers || {}) };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return { ok: false, status: 0, error: aborted ? `timeout after ${timeoutMs}ms` : (err?.message || String(err)) };
  } finally {
    clearTimeout(timer);
  }
}
