import { classifyLiveness } from '../liveness-core.mjs';
import { LIVENESS_CONTEXT_OPTIONS, rejectPrivateOrInvalid, validateUrlSecurity, sameOrigin } from '../liveness-browser.mjs';

export function koreanPortal(url) {
  const host = new URL(url).hostname;
  return /(^|\.)(jobkorea|saramin|wanted)\.co\.kr$/.test(host);
}

// One queue across providers, JD extraction and evaluation. A rejected visit
// must not poison the next visit. Each visit owns and closes its browser.
let tail = Promise.resolve();
export function readJobPage(url, options = {}) {
  const run = tail.then(() => visit(url, options));
  tail = run.catch(() => {});
  return run;
}

async function visit(url, { listing, timeout = 30_000, settleMs = 1500, launchBrowser, setupContext, screenshot } = {}) {
  const guard = rejectPrivateOrInvalid(url);
  if (guard) throw new Error(guard.reason);
  const launch = launchBrowser || (async (opts) => (await import('playwright')).chromium.launch(opts));
  let browser;
  try {
    browser = await launch({ headless: true });
    const context = await browser.newContext({ ...LIVENESS_CONTEXT_OPTIONS, locale: 'ko-KR' });
    await context.route('**/*', async route => {
      const target = route.request().url();
      if (rejectPrivateOrInvalid(target)) return route.abort('blockedbyclient');
      try { await validateUrlSecurity(target); } catch { return route.abort('blockedbyclient'); }
      return route.continue();
    });
    // In-process fixture seam; never exposed as a CLI flag or environment bypass.
    if (setupContext) await setupContext(context);
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    if (listing) {
      const selector = listing === 'jobkorea'
        ? '[data-sentry-component="CardJob"] a[href*="GI_Read/"], .list-post a[href*="GI_Read/"]'
        : '.item_recruit .job_tit a[href*="rec_idx="], .list_item .job_tit a[href*="rec_idx="]';
      await page.waitForSelector(selector, { timeout: Math.min(timeout, 10_000) }).catch(() => {});
    }
    await page.waitForTimeout(settleMs);
    if (rejectPrivateOrInvalid(page.url())) throw new Error('Blocked final URL');
    const raw = await readJobDom(page, listing);
    if (!listing) {
      for (const frame of page.frames()) {
        if (frame === page.mainFrame() || !sameOrigin(frame.url(), page.url())) continue;
        const embedded = await readJobDom(frame).catch(() => null);
        if (!embedded?.text.trim()) continue;
        raw.text += '\n\n' + embedded.text;
        raw.bodyText += '\n\n' + embedded.bodyText;
        raw.applyControls.push(...embedded.applyControls);
      }
    }
    const status = response?.status() ?? 0;
    let liveness = classifyLiveness({ status, requestedUrl: url, finalUrl: page.url(), bodyText: raw.bodyText, applyControls: raw.applyControls });
    if (koreanPortal(url) && ['insufficient_content', 'no_apply_control', 'listing_page'].includes(liveness.code)) {
      liveness = { result: 'uncertain', code: 'unverified_content', reason: 'posting content or apply control could not be verified' };
    }
    let screenshotError;
    if (screenshot) {
      try { await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled', timeout: 10_000 }); }
      catch (err) { screenshotError = String(err.message).split('\n')[0]; }
    }
    return { ...raw, url: page.url(), status, liveness, observedAt: new Date().toISOString(), ...(screenshotError ? { screenshotError } : {}) };
  } finally {
    if (browser) await browser.close();
  }
}

export async function readJobDom(page, listing) {
  return page.evaluate((portal) => {
    const visible = el => el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const clean = s => (s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    const textOf = (root, selectors) => {
      for (const s of selectors) {
        const el = root.querySelector(s);
        if (visible(el)) return clean(el.innerText || el.getAttribute('title'));
      }
      return '';
    };
    const bodyText = document.body?.innerText || '';
    const root = document.querySelector('main, [role="main"], article, #content, #content-area') || document.body;
    // Read visible text without mutating the page (innerText of a detached
    // clone drops layout information and can return an empty string).
    const text = root?.innerText || bodyText;
    const anchors = [...document.querySelectorAll('a[href]')].filter(visible)
      .filter(el => !el.closest('nav,header,footer'))
      .map(el => ({ href: el.getAttribute('href'), label: clean(el.innerText) }));
    const applyControls = [...document.querySelectorAll('a,button,input[type="submit"],[role="button"]')]
      .filter(visible).filter(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true')
      .filter(el => !el.closest('nav,header,footer'))
      .map(el => clean(el.innerText || el.value || el.getAttribute('aria-label')));
    const jobs = [];
    const seen = new Set();
    if (portal) {
      const cards = portal === 'jobkorea'
        ? document.querySelectorAll('[data-sentry-component="CardJob"], .list-post > li, .recruit-info .post')
        : document.querySelectorAll('.item_recruit, .list_item');
      for (const card of cards) {
        if (!visible(card) || card.closest('nav,header,footer,[data-recommendation]')) continue;
        // querySelector on a comma union returns DOM order, so the company
        // logo link would win over Title and its empty text drops every card.
        const a = portal === 'jobkorea'
          ? card.querySelector('a[data-sentry-component="Title"]') || card.querySelector('a.title[href*="GI_Read/"]')
          : card.querySelector('.job_tit a[href*="rec_idx="]');
        if (!visible(a)) continue;
        const link = new URL(a.getAttribute('href'), location.href);
        const id = portal === 'jobkorea' ? link.pathname.match(/\/GI_Read\/(\d+)/i)?.[1] : link.searchParams.get('rec_idx');
        if (!/^\d+$/.test(id || '') || link.hostname !== location.hostname || seen.has(id)) continue;
        let company = textOf(card, portal === 'jobkorea' ? ['[data-sentry-component="CompanyName"]', '.corp-name', '.name.dev_view'] : ['.corp_name a', '.corp_name']);
        if (!company && portal === 'jobkorea') company = clean(card.querySelector('img[alt$=" 로고"]')?.alt.replace(/\s+로고$/, ''));
        const title = clean(a.getAttribute('title') || a.innerText);
        const region = portal === 'jobkorea' ? textOf(card, ['[data-sentry-component="Location"]', '[data-sentry-component="GrayChip"]:has(.emoji--basicemoji-place2)', '.loc', '.location', '.workplace']) : textOf(card, ['.job_condition span:first-child', '.location']);
        if (!company || !title) continue;
        seen.add(id);
        jobs.push({ id, title, company, location: region, url: portal === 'jobkorea'
          ? `${link.origin}/Recruit/GI_Read/${id}` : `${link.origin}/zf_user/jobs/relay/view?rec_idx=${id}` });
      }
    }
    return { title: clean(document.querySelector('h1')?.innerText || document.title), text, bodyText, anchors, applyControls, jobs };
  }, listing);
}
