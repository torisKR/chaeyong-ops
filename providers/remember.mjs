// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Remember (리멤버) provider — public listing pages on career.rememberapp.co.kr.
// Configure via `job_boards` with `provider: remember`:
//
//   - name: Remember (KR)
//     provider: remember
//     careers_url: https://career.rememberapp.co.kr/job/postings
//     searchKeywords: "백엔드"
//     max_pages: 3
//     enabled: false
//
// robots.txt (fetched 2026-09-14):
//   User-agent: *  Allow: /job/  and /sitemap*.xml
//   Disallow: /*?*seed=  /job/private-positions/  /job/sign-in-guide
//             /job/posting-group/  /job/apply-related/  /job_postings/ (B2B)
//
// This is a read-only HTML stub. It never logs in, never sends `seed=`, never
// hits B2B/private paths, and never circumvents Cloudflare/WAF challenges
// (career-ops does not work around bot protection). Datacenter IPs often
// receive a challenge page; that is reported as a named error, not repaired.
// Leave `enabled: false` until you have confirmed Remember's terms of service
// and robots.txt still allow this read from your network.
//
// Title matching is the scanner's `title_filter` (same as yourator): Remember's
// SPA search query is undocumented, so this provider paginates the public
// `/job/postings` list instead of guessing a keyword parameter.

import { BROWSER_LIKE_USER_AGENT } from './_http.mjs';
import { decodeEntities } from './_html-entities.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

const SITE_ORIGIN = 'https://career.rememberapp.co.kr';
const TRUSTED_HOST = 'career.rememberapp.co.kr';
const LIST_PATH = '/job/postings';
const DEFAULT_MAX_PAGES = 3;
const MAX_PAGES_CAP = 10;
const INTER_PAGE_DELAY_MS = 400;

/** Thrown when the listing is a Cloudflare/WAF interstitial. Keep in sync with tests. */
export const CHALLENGE_MESSAGE =
  'remember: listing page is behind Cloudflare/WAF bot protection. ' +
  'This provider does not circumvent challenges. Leave enabled: false unless you have ' +
  "confirmed Remember's terms of service and robots.txt allow this read, and the listing " +
  'HTML is reachable from your network. See docs/SUPPORTED_JOB_BOARDS.md.';

/** Thrown when page 1 is reachable but has no parseable postings. */
export const SPA_EMPTY_MESSAGE =
  'remember: search page returned no parseable postings — markup may have changed, ' +
  'or the page is a client-rendered SPA with no server-rendered cards. ' +
  'This provider does not drive a browser or log in.';

const POSTING_ID_RE = /\/job\/postings\/([A-Za-z0-9_-]+)/i;
const POSTING_ANCHOR_RE =
  /<a\b[^>]*href="([^"]*\/job\/postings\/[A-Za-z0-9_-]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

/** @param {string} url */
function assertRememberUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`remember: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`remember: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`remember: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  if (parsed.searchParams.has('seed')) {
    throw new Error('remember: seed= query is disallowed by robots.txt');
  }
  const path = parsed.pathname;
  if (
    path.startsWith('/job/private-positions') ||
    path.startsWith('/job/sign-in-guide') ||
    path.startsWith('/job/posting-group') ||
    path.startsWith('/job/apply-related') ||
    path.startsWith('/job_postings')
  ) {
    throw new Error(`remember: path is robots-disallowed: ${path}`);
  }
  return url;
}

function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Public listing URL. Page 1 is the bare path Remember itself links;
 * later pages use `?page=N`. Never adds `seed=` (robots.txt Disallow).
 *
 * @param {number} page 1-based
 */
export function buildRememberListUrl(page) {
  const n = Number.isInteger(page) && page > 1 ? page : 1;
  const url = n === 1 ? `${SITE_ORIGIN}${LIST_PATH}` : `${SITE_ORIGIN}${LIST_PATH}?page=${n}`;
  assertRememberUrl(url);
  return url;
}

/** @param {string} html */
export function isRememberChallengePage(html) {
  if (!html) return false;
  return /cf-error-details|just a moment|attention required|sorry, you have been blocked|cf-browser-verification|challenge-platform/i.test(
    html,
  );
}

/** @param {string} href */
function postingIdFromHref(href) {
  if (!href) return null;
  const match = href.match(POSTING_ID_RE);
  if (!match) return null;
  const id = match[1];
  if (!id || id === 'page') return null;
  return id;
}

/** @param {string} id */
function postingUrl(id) {
  const seg = safeEncodeURIComponent(id);
  if (seg === null) return null;
  return `${SITE_ORIGIN}${LIST_PATH}/${seg}`;
}

/** @param {string} html */
function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {any} node
 * @param {Map<string, { title: string, url: string, company: string, location: string }>} out
 * @param {string} fallbackCompany
 */
function collectJobsFromUnknownJson(node, out, fallbackCompany) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectJobsFromUnknownJson(item, out, fallbackCompany);
    return;
  }
  if (typeof node !== 'object') return;

  const rawUrl = typeof node.url === 'string' ? node.url : typeof node.jobUrl === 'string' ? node.jobUrl : '';
  const id =
    postingIdFromHref(rawUrl) ||
    (node.id != null ? String(node.id) : '') ||
    (node.jobId != null ? String(node.jobId) : '') ||
    (node.postingId != null ? String(node.postingId) : '');
  const title =
    (typeof node.title === 'string' && node.title.trim()) ||
    (typeof node.position === 'string' && node.position.trim()) ||
    (typeof node.jobTitle === 'string' && node.jobTitle.trim()) ||
    '';

  if (id && title && POSTING_ID_RE.test(`/job/postings/${id}`)) {
    const url = postingUrl(id);
    if (url && !out.has(url)) {
      const companyObj = node.company;
      const company =
        (typeof node.companyName === 'string' && node.companyName.trim()) ||
        (typeof companyObj === 'string' && companyObj.trim()) ||
        (companyObj && typeof companyObj.name === 'string' && companyObj.name.trim()) ||
        fallbackCompany ||
        'Remember';
      const loc = node.location;
      const location =
        (typeof loc === 'string' && loc.trim()) ||
        (loc && typeof loc.name === 'string' && loc.name.trim()) ||
        (typeof node.address === 'string' && node.address.trim()) ||
        '';
      out.set(url, { title, url, company, location });
    }
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') collectJobsFromUnknownJson(value, out, fallbackCompany);
  }
}

/**
 * @param {string} html
 * @param {string} [fallbackCompany]
 */
function parseJsonLdJobs(html, fallbackCompany) {
  const out = [];
  const seen = new Set();
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    let data;
    try {
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      const graph = Array.isArray(node?.['@graph']) ? node['@graph'] : [node];
      for (const item of graph) {
        const types = item?.['@type'];
        const typeList = Array.isArray(types) ? types : [types];
        if (!typeList.some((t) => typeof t === 'string' && t.toLowerCase() === 'jobposting')) continue;
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        const rawUrl = typeof item.url === 'string' ? item.url : '';
        const id = postingIdFromHref(rawUrl);
        if (!title || !id) continue;
        const url = postingUrl(id);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        const org = item.hiringOrganization;
        const company =
          (org && typeof org.name === 'string' && org.name.trim()) || fallbackCompany || 'Remember';
        const loc = item.jobLocation;
        const location =
          (loc && loc.address && typeof loc.address.addressLocality === 'string' && loc.address.addressLocality.trim()) ||
          (typeof loc === 'string' && loc.trim()) ||
          '';
        out.push({ title, url, company, location });
      }
    }
  }
  return out;
}

/**
 * @param {string} html
 * @param {string} [fallbackCompany]
 */
function parseNextDataJobs(html, fallbackCompany) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const collected = new Map();
  collectJobsFromUnknownJson(data, collected, fallbackCompany);
  return [...collected.values()];
}

/**
 * @param {string} html
 * @param {string} [fallbackCompany]
 */
function parseAnchorJobs(html, fallbackCompany) {
  const out = [];
  const seen = new Set();
  for (const match of html.matchAll(POSTING_ANCHOR_RE)) {
    const id = postingIdFromHref(match[1]);
    if (!id) continue;
    const title = stripTags(match[2] ?? '');
    if (!title) continue;
    const url = postingUrl(id);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      title,
      url,
      company: fallbackCompany || 'Remember',
      location: '',
    });
  }
  return out;
}

/**
 * Parse a Remember listing HTML page (JSON-LD, Next.js payload, or anchors).
 *
 * @param {string} html
 * @param {string} [fallbackCompany]
 */
export function parseRememberSearchPage(html, fallbackCompany) {
  if (!html) return [];
  const jsonLd = parseJsonLdJobs(html, fallbackCompany);
  if (jsonLd.length) return jsonLd;
  const nextData = parseNextDataJobs(html, fallbackCompany);
  if (nextData.length) return nextData;
  return parseAnchorJobs(html, fallbackCompany);
}

/** @param {any} err */
function isChallengeError(err) {
  const status = err?.status;
  return status === 403 || status === 429 || status === 503;
}

/**
 * @param {any} ctx
 * @param {string} url
 */
async function fetchRememberHtml(ctx, url) {
  try {
    return await ctx.fetchText(url, {
      redirect: 'error',
      headers: { 'User-Agent': BROWSER_LIKE_USER_AGENT, 'Accept-Language': 'ko-KR,ko;q=0.9' },
    });
  } catch (err) {
    if (isChallengeError(err) || isRememberChallengePage(err?.body || '')) {
      throw new Error(CHALLENGE_MESSAGE);
    }
    throw err;
  }
}

/** @type {Provider} */
export default {
  id: 'remember',

  detect(entry) {
    return entry?.provider === 'remember' ? { url: `${SITE_ORIGIN}${LIST_PATH}` } : null;
  },

  async fetch(entry, ctx) {
    const maxPages = Math.min(resolveMaxPages(entry), ctx?.maxPages ?? Number.POSITIVE_INFINITY);
    const fallbackCompany = entry?.name;
    const out = [];
    const seen = new Set();

    for (let page = 1; page <= maxPages; page++) {
      const url = buildRememberListUrl(page);
      const html = await fetchRememberHtml(ctx, url);
      if (isRememberChallengePage(html)) throw new Error(CHALLENGE_MESSAGE);

      const rows = parseRememberSearchPage(html, fallbackCompany);
      if (rows.length === 0) {
        if (page === 1) throw new Error(SPA_EMPTY_MESSAGE);
        break;
      }
      for (const row of rows) {
        if (seen.has(row.url)) continue;
        seen.add(row.url);
        out.push(row);
      }
      if (page < maxPages) {
        await (ctx.sleep ? ctx.sleep(INTER_PAGE_DELAY_MS) : new Promise((r) => setTimeout(r, INTER_PAGE_DELAY_MS)));
      }
    }
    return out;
  },
};
