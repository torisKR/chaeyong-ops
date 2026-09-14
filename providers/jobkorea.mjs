// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// JobKorea (잡코리아) provider — HTML search pages on jobkorea.co.kr.
// Configure via `job_boards` with `provider: jobkorea`:
//
//   - name: JobKorea (KR)
//     provider: jobkorea
//     careers_url: https://www.jobkorea.co.kr/
//     searchKeywords: "python"
//     max_pages: 5
//     enabled: true
//
// Parses server-rendered search cards (CardJob / Title components).
// Respect JobKorea's terms of service before enabling automated scans.

import { BROWSER_LIKE_USER_AGENT } from './_http.mjs';
import { decodeEntities } from './_html-entities.mjs';

const SITE_ORIGIN = 'https://www.jobkorea.co.kr';
const TRUSTED_HOST = 'www.jobkorea.co.kr';
const DEFAULT_MAX_PAGES = 5;
const MAX_PAGES_CAP = 20;
const INTER_PAGE_DELAY_MS = 300;

/** @param {string} url */
function assertJobkoreaUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`jobkorea: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`jobkorea: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`jobkorea: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
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
export function buildJobkoreaSearchUrl(keyword, page) {
  const params = new URLSearchParams({
    stext: keyword || '개발',
    tabType: 'recruit',
    Page_No: String(page),
  });
  const url = `${SITE_ORIGIN}/Search/?${params}`;
  assertJobkoreaUrl(url);
  return url;
}

/**
 * @param {string} html
 */
export function parseJobkoreaSearchPage(html) {
  const out = [];
  const seen = new Set();
  if (!html) return out;

  const cardRe = /data-sentry-component="CardJob"[\s\S]*?(?=data-sentry-component="CardJob"|$)/gi;
  for (const card of html.matchAll(cardRe)) {
    const block = card[0];
    const idMatch = block.match(/GI_Read\/(\d+)/i);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (seen.has(id)) continue;

    const companyMatch = block.match(/alt="([^"]+)\s+로고"/i);
    const company = companyMatch ? decodeEntities(companyMatch[1]).trim() : '';

    const titleMatch = block.match(/data-sentry-component="Title"[\s\S]*?>([^<]+)</i);
    let title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : '';
    if (!title) {
      const onclickMatch = block.match(/onclick="GA_Event\([^,]+,[^,]+,[^,]+,\s*'([^']+)'/i);
      title = onclickMatch ? decodeEntities(onclickMatch[1]).trim() : '';
    }
    if (!title) continue;

    seen.add(id);
    const url = `${SITE_ORIGIN}/Recruit/GI_Read/${id}`;
    out.push({
      title,
      url,
      company: company || 'JobKorea',
      location: '',
    });
  }

  // Legacy markup fallback (older list pages).
  if (out.length === 0) {
    const legacyRe =
      /href="\/Recruit\/GI_Read\/(\d+)[^"]*"[^>]*onclick="GA_Event\([^,]+,[^,]+,\s*'([^']+)'/gi;
    for (const match of html.matchAll(legacyRe)) {
      const id = match[1];
      if (seen.has(id)) continue;
      const title = decodeEntities(match[2] ?? '').trim();
      if (!title) continue;
      seen.add(id);
      out.push({
        title,
        url: `${SITE_ORIGIN}/Recruit/GI_Read/${id}`,
        company: 'JobKorea',
        location: '',
      });
    }
  }

  return out;
}

/** @type {Provider} */
export default {
  id: 'jobkorea',

  async fetch(entry, ctx) {
    const keyword = resolveKeyword(entry);
    const maxPages = Math.min(resolveMaxPages(entry), ctx?.maxPages ?? Number.POSITIVE_INFINITY);
    const out = [];
    const seen = new Set();

    for (let page = 1; page <= maxPages; page++) {
      const url = buildJobkoreaSearchUrl(keyword, page);
      const html = await ctx.fetchText(url, {
        redirect: 'error',
        headers: { 'User-Agent': BROWSER_LIKE_USER_AGENT, 'Accept-Language': 'ko-KR,ko;q=0.9' },
      });
      const rows = parseJobkoreaSearchPage(html);
      if (rows.length === 0) {
        if (page === 1) {
          throw new Error('jobkorea: search page returned no parseable postings — markup may have changed');
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
