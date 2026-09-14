// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Wanted (원티드) provider — wanted.co.kr public jobs JSON API.
// Configure via `job_boards` with `provider: wanted`:
//
//   - name: Wanted (KR)
//     provider: wanted
//     careers_url: https://www.wanted.co.kr/
//     searchKeywords: "백엔드"
//     max_pages: 5
//     enabled: true
//
// Uses GET /api/v4/jobs (country=kr, job_sort=job.latest_order). The API is
// Wanted's own listing interface; this provider only reads public listings.
// Official OpenAPI keys are optional and not required for this endpoint.
// Respect Wanted's terms of service before enabling in production.

const SITE_ORIGIN = 'https://www.wanted.co.kr';
const TRUSTED_HOST = 'www.wanted.co.kr';
const DEFAULT_LIMIT = 50;
const DEFAULT_MAX_PAGES = 10;
const MAX_PAGES_CAP = 50;
const PAGE_DELAY_MS = 200;

/** @param {string} url */
function assertWantedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`wanted: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`wanted: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`wanted: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

function resolveKeyword(entry) {
  const kw = entry?.searchKeywords ?? entry?.keyword ?? '';
  return typeof kw === 'string' ? kw.trim() : '';
}

/**
 * @param {string} keyword
 * @param {number} limit
 * @param {number} offset
 */
export function buildWantedApiUrl(keyword, limit, offset) {
  const params = new URLSearchParams({
    country: 'kr',
    locations: 'all',
    years: '-1',
    job_sort: 'job.latest_order',
    limit: String(limit),
    offset: String(offset),
  });
  if (keyword) params.set('keyword', keyword);
  const url = `${SITE_ORIGIN}/api/v4/jobs?${params}`;
  assertWantedUrl(url);
  return url;
}

/**
 * @param {any} job
 * @param {string} [fallbackCompany]
 */
export function normalizeWantedJob(job, fallbackCompany) {
  if (!job || typeof job !== 'object') return null;
  const id = job.id;
  if (id == null) return null;

  const title = typeof job.position === 'string' ? job.position.trim() : '';
  if (!title) return null;

  const url = `${SITE_ORIGIN}/wd/${id}`;
  const brand = typeof job.company?.name === 'string' ? job.company.name.trim() : '';
  const company = brand || fallbackCompany || 'Wanted';

  const addr = job.address;
  let location = '';
  if (addr && typeof addr === 'object') {
    const parts = [addr.location, addr.district].filter((p) => typeof p === 'string' && p.trim());
    location = parts.join(' ').trim();
  }

  return { title, url, company, location };
}

/** @type {Provider} */
export default {
  id: 'wanted',

  async fetch(entry, ctx) {
    const keyword = resolveKeyword(entry);
    const maxPages = Math.min(resolveMaxPages(entry), ctx?.maxPages ?? Number.POSITIVE_INFINITY);
    const fallbackCompany = entry?.name;
    const out = [];
    const seen = new Set();

    for (let page = 0; page < maxPages; page++) {
      const offset = page * DEFAULT_LIMIT;
      const url = buildWantedApiUrl(keyword, DEFAULT_LIMIT, offset);
      const json = await ctx.fetchJson(url, { redirect: 'error' });
      const rows = json?.data;
      if (!Array.isArray(rows)) {
        throw new Error(
          `wanted: unexpected API response on page ${page + 1} — expected { data: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
        );
      }
      if (rows.length === 0) break;

      for (const job of rows) {
        const normalized = normalizeWantedJob(job, fallbackCompany);
        if (!normalized || seen.has(normalized.url)) continue;
        seen.add(normalized.url);
        out.push(normalized);
      }

      if (!json?.links?.next) break;
      if (page + 1 < maxPages) {
        await (ctx.sleep ? ctx.sleep(PAGE_DELAY_MS) : new Promise((r) => setTimeout(r, PAGE_DELAY_MS)));
      }
    }
    return out;
  },
};
