// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Saramin (사람인) provider — HTML list/search pages on saramin.co.kr.
// Configure via `job_boards` with `provider: saramin`:
//
//   - name: Saramin (KR)
//     provider: saramin
//     careers_url: https://www.saramin.co.kr/
//     searchKeywords: "백엔드"
//     max_pages: 5
//     enabled: true
//
// Parses server-rendered search results. Respect Saramin's terms of service
// and robots.txt before enabling automated scans.

import { BROWSER_LIKE_USER_AGENT } from './_http.mjs';
import { decodeEntities } from './_html-entities.mjs';

const SITE_ORIGIN = 'https://www.saramin.co.kr';
const TRUSTED_HOST = 'www.saramin.co.kr';
const DEFAULT_MAX_PAGES = 5;
const MAX_PAGES_CAP = 20;
const PAGE_SIZE = 40;
const INTER_PAGE_DELAY_MS = 300;

const JOB_RE =
  /<h2 class="job_tit">\s*<a[^>]*title="([^"]*)"[^>]*href="[^"]*rec_idx=(\d+)[^"]*"/gi;

/** @param {string} url */
function assertSaraminUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`saramin: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`saramin: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`saramin: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
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
 * @param {number} page 1-based
 */
export function buildSaraminSearchUrl(keyword, page) {
  const params = new URLSearchParams({
    searchword: keyword || '개발',
    recruitPage: String(page),
    recruitPageCount: String(PAGE_SIZE),
  });
  const url = `${SITE_ORIGIN}/zf_user/search?${params}`;
  assertSaraminUrl(url);
  return url;
}

/**
 * @param {string} html
 * @param {string} [fallbackCompany]
 */
export function parseSaraminSearchPage(html, fallbackCompany) {
  const out = [];
  const seen = new Set();
  if (!html) return out;

  for (const match of html.matchAll(JOB_RE)) {
    const title = decodeEntities(match[1] ?? '').replace(/\s+/g, ' ').trim();
    const recIdx = match[2];
    if (!title || !recIdx || seen.has(recIdx)) continue;
    seen.add(recIdx);
    const url = `${SITE_ORIGIN}/zf_user/jobs/relay/view?rec_idx=${recIdx}`;
    out.push({
      title,
      url,
      company: fallbackCompany || 'Saramin',
      location: '',
    });
  }
  return out;
}

/** @type {Provider} */
export default {
  id: 'saramin',

  async fetch(entry, ctx) {
    const keyword = resolveKeyword(entry);
    const maxPages = Math.min(resolveMaxPages(entry), ctx?.maxPages ?? Number.POSITIVE_INFINITY);
    const fallbackCompany = entry?.name;
    const out = [];
    const seen = new Set();

    for (let page = 1; page <= maxPages; page++) {
      const url = buildSaraminSearchUrl(keyword, page);
      const html = await ctx.fetchText(url, {
        redirect: 'error',
        headers: { 'User-Agent': BROWSER_LIKE_USER_AGENT, 'Accept-Language': 'ko-KR,ko;q=0.9' },
      });
      const rows = parseSaraminSearchPage(html, fallbackCompany);
      if (rows.length === 0) {
        if (page === 1) {
          throw new Error('saramin: search page returned no parseable postings — markup may have changed');
        }
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
