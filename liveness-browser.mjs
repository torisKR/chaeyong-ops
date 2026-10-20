/**
 * liveness-browser.mjs — Playwright-driven liveness check for a single URL.
 *
 * Shared by check-liveness.mjs (CLI tool) and scan.mjs (--verify flag).
 * Returns the same shape as classifyLiveness: { result, reason }.
 */

import { classifyLiveness } from './liveness-core.mjs';
import { BROWSER_LIKE_USER_AGENT } from './user-agent.mjs';
import { BROWSER_EGRESS_LAUNCH_OPTIONS, newGuardedBrowserContext, closeGuardedBrowserContext, isGuardedContext, resetPageEgress, rejectPrivateOrInvalid, validateUrlSecurity } from './lib/browser-egress.mjs';
export { rejectPrivateOrInvalid, validateUrlSecurity, setHostResolver } from './lib/browser-egress.mjs';

const NAVIGATE_TIMEOUT_MS = 15_000;
const HYDRATION_WAIT_MS = 2_000;
// Upper bound on the extra wait for a same-origin child frame to populate, and
// the poll interval inside it. Only spent when such a frame exists at all.
const FRAME_CONTENT_TIMEOUT_MS = 6_000;
const FRAME_CONTENT_POLL_MS = 500;

/**
 * Same-origin test used to decide whether a child frame is part of the posting
 * or somebody else's widget. Deliberately strict: about:blank, data: frames,
 * tag managers and ad iframes all fail it, so only the ATS's own embedded
 * document contributes text and apply controls.
 */
export function sameOrigin(frameUrl, pageUrl) {
  try {
    const a = new URL(frameUrl);
    const b = new URL(pageUrl);
    if (a.protocol !== 'http:' && a.protocol !== 'https:') return false;
    return a.origin === b.origin;
  } catch {
    return false;
  }
}

// The default Playwright headless UA contains "HeadlessChrome", which Cloudflare
// and similar WAFs flag — portals like pracuj.pl then serve a 403 challenge page
// instead of the posting. Presenting a normal desktop Chrome UA clears the wall
// headlessly (the scan parser scripts/parsers/pracuj-jobs.mjs relies on the same
// trick), so the common case never needs the slower headed-browser fallback.
export const LIVENESS_CONTEXT_OPTIONS = {
  userAgent: BROWSER_LIKE_USER_AGENT,
  locale: 'en-US',
};

// Open a page in a context that already presents a realistic UA. Both callers use
// this instead of browser.newPage() so headless checks aren't instantly bot-walled.
export async function newLivenessPage(browser, { egressOptions } = {}) {
  const context = await newGuardedBrowserContext(browser, LIVENESS_CONTEXT_OPTIONS, egressOptions);
  try { return await context.newPage(); }
  catch (error) { await closeGuardedBrowserContext(context); throw error; }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Throttle delay with jitter: a value in [baseMs, 2*baseMs). Spacing requests out
// (and randomizing the gap) keeps a bulk run under rate-based WAF thresholds —
// pracuj.pl's Cloudflare flags the session after ~2 rapid hits, after which even
// headed retries are blocked. A randomized gap also avoids a fixed-cadence
// fingerprint. Returns 0 for a non-positive base (throttling disabled).
export function jitteredDelayMs(baseMs) {
  if (!baseMs || baseMs <= 0) return 0;
  return baseMs + Math.floor(Math.random() * baseMs);
}

export async function checkUrlLiveness(page, url, { extraSettleMs = 0 } = {}) {
  if (/^https:\/\/(?:www\.)?(?:jobkorea|saramin|wanted)\.co\.kr\//i.test(url)) {
    try {
      const { readJobPage } = await import('./lib/job-browser.mjs');
      return (await readJobPage(url)).liveness;
    } catch (err) {
      return { result: 'uncertain', code: 'navigation_error', reason: String(err.message).split('\n')[0] };
    }
  }

  const guardError = rejectPrivateOrInvalid(url);
  if (guardError) {
    return { result: 'uncertain', code: guardError.code, reason: guardError.reason };
  }
  if (typeof page?.context === 'function' && !isGuardedContext(page.context())) {
    return { result: 'uncertain', code: 'blocked_host', reason: 'Browser context has no enforced egress proxy' };
  }
  if (page) {
    page._blockedByGuard = null;
    resetPageEgress(page);
  }
  // Lightweight doubles retain the routing checks; real pages are guarded at
  // their context and TCP connection boundary, including browser redirects.
  if (page && typeof page.context !== 'function' && typeof page.route === 'function' && !page._routeInterceptorRegistered) {
    page._routeInterceptorRegistered = true;
    await page.route('**/*', async (route) => {
      const requestUrl = route.request().url();
      const errGuard = rejectPrivateOrInvalid(requestUrl);
      if (errGuard) {
        console.warn(`Blocked request to restricted destination: ${requestUrl}`);
        page._blockedByGuard = errGuard;
        return route.abort('blockedbyclient');
      }
      try {
        await validateUrlSecurity(requestUrl);
        return route.continue();
      } catch (err) {
        console.warn(`Blocked request to restricted destination (DNS): ${requestUrl} - ${err.message}`);
        // A host that resolves to nothing is a DEAD THIRD-PARTY SCRIPT, not a
        // statement about the posting. Measured 2026-08-14 over a 217-URL
        // recheck: 78 live postings were returned as `uncertain` because an
        // analytics or ad host on the page no longer exists — 53 on
        // personalisation.visitorqueue.com, 17 on s7.addthis.com (AddThis was
        // shut down in 2023), the rest on fluidads and cloudfront. One was
        // opened by hand to confirm: 11,178 characters of live posting and a
        // working apply control, called uncertain because of a dead tracker.
        //
        // The request is still aborted either way, so the egress guard loses
        // nothing. Only the VERDICT stops being poisoned, and only for a
        // subresource: if the main document itself cannot resolve, that is a
        // real finding about the posting and still counts.
        // Whether this was the main document or a subresource can only be asked
        // of a real Playwright request. Callers may pass a lighter route double
        // (the test suite does, with request() returning just a url()), and for
        // those the answer is unknowable — so default to TRUE, which keeps the
        // pre-existing behaviour of poisoning the verdict. The relaxation only
        // applies where we can positively establish it was a subresource.
        const request = typeof route?.request === 'function' ? route.request() : null;
        const canTell =
          typeof request?.isNavigationRequest === 'function' &&
          typeof request?.frame === 'function' &&
          typeof page?.mainFrame === 'function';
        const isMainDocument = canTell
          ? request.isNavigationRequest() && request.frame() === page.mainFrame()
          : true;
        if (err?.livenessCode !== 'dns_no_addresses' || isMainDocument) {
          page._blockedByGuard = { code: 'blocked_host', reason: err.message };
        }
        return route.abort('blockedbyclient');
      }
    });
  }
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATE_TIMEOUT_MS });
    const status = response?.status() ?? 0;

    // Give SPAs (Ashby, Lever, Workday) time to hydrate. extraSettleMs adds slack
    // for the headed retry, where a JS anti-bot interstitial needs a moment to clear.
    await page.waitForTimeout(HYDRATION_WAIT_MS + extraSettleMs);

    const finalUrl = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    const extractApplyControls = () => {
      const candidates = Array.from(
        document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]')
      );

      return candidates
        .filter((element) => {
          if (element.closest('nav, header, footer')) return false;
          if (element.closest('[aria-hidden="true"]')) return false;

          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (!element.getClientRects().length) return false;

          return Array.from(element.getClientRects()).some((rect) => rect.width > 0 && rect.height > 0);
        })
        .map((element) => {
          const label = [
            element.innerText,
            element.value,
            element.getAttribute('aria-label'),
            element.getAttribute('title'),
          ]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          return label;
        })
        .filter(Boolean);
    };

    let applyControls = await page.evaluate(extractApplyControls);
    let frameText = '';

    // Some ATS render the whole posting inside a same-origin iframe and leave the
    // top-level document as an empty shell. iCIMS is the reference case: measured
    // 2026-08-14, the outer document of a LIVE posting held 13 characters and no
    // apply control, so classifyLiveness reached `insufficient_content` and called
    // it expired. 92 live postings were closed that way in one sweep, and a false
    // `expired` is the expensive direction — it is written to scan-history as
    // skipped_expired and dedup-filters the job out of every later scan.
    //
    // Reading same-origin child frames cannot resurrect a dead posting: a removed
    // iCIMS job answers HTTP 410 at the top level (verified on two fabricated job
    // ids and one genuinely dead posting), so it short-circuits on status long
    // before any content check, and its error frame carries zero apply controls.
    // The frame ATTACHES fast but FILLS late. Measured on iCIMS 2026-08-14: the
    // same-origin child frame is present at 2000ms with 0 characters and only
    // populates between 3000 and 4000ms, so reading it at HYDRATION_WAIT_MS gets
    // an empty document and changes nothing. Poll until it has content, bounded.
    // The cost is only paid on pages that actually have a same-origin child
    // frame, so the ATS that render inline are unaffected.
    // Frame aggregation is an enhancement, never a requirement. Callers may pass
    // a lightweight page object that only implements goto/url/evaluate — the
    // test doubles in test-all.mjs do — and such a caller must keep getting the
    // top-level verdict rather than a navigation_error.
    const supportsFrames = typeof page?.frames === 'function' && typeof page?.mainFrame === 'function';

    const childFrames = () =>
      !supportsFrames
        ? []
        : page.frames().filter((frame) => {
            if (frame === page.mainFrame()) return false;
            try {
              return sameOrigin(frame.url() || '', finalUrl); // excludes about:blank, ads, tag managers
            } catch {
              return false;
            }
          });

    // A 404/410 is decided by the status line alone, so no amount of frame
    // content can change it. Without this, a dead posting whose error page also
    // renders into an iframe pays the poll while that error page fills, purely
    // to be told what the status already said. Measured on two dead iCIMS
    // postings: 5822ms and 3314ms end to end, the spread being poll iterations.
    //
    // The status rule is NOT restated here. classifyLiveness owns it, so this
    // asks it and keys off the code it returns; a duplicated `status === 410`
    // would be a second copy of that rule waiting to drift.
    const topLevelVerdict = classifyLiveness({ status, requestedUrl: url, finalUrl, bodyText, applyControls });
    if (topLevelVerdict.code === 'http_gone') {
      return topLevelVerdict;
    }

    if (childFrames().length > 0) {
      const deadline = Date.now() + FRAME_CONTENT_TIMEOUT_MS;
      // Wait for EVERY qualifying frame, not merely the first one to fill: with
      // two same-origin frames the posting could otherwise be read while still
      // empty. Measured across five iCIMS tenants there is exactly one
      // qualifying frame per page, so in practice this is the same loop.
      for (;;) {
        let anyEmpty = false;
        for (const frame of childFrames()) {
          try {
            const probe = await frame.evaluate(() => document.body?.innerText ?? '');
            if (!probe.trim()) anyEmpty = true;
          } catch {
            // detached mid-poll; try again on the next tick
          }
        }
        if (!anyEmpty || Date.now() >= deadline) break;
        await page.waitForTimeout(FRAME_CONTENT_POLL_MS);
      }
    }

    for (const frame of childFrames()) {
      try {
        const text = await frame.evaluate(() => document.body?.innerText ?? '');
        if (text && text.trim()) frameText += '\n' + text;
        applyControls = applyControls.concat(await frame.evaluate(extractApplyControls));
      } catch {
        // detached or cross-origin mid-read; the top-level reading still stands
      }
    }

    if (page && page._blockedByGuard) {
      return { result: 'uncertain', code: page._blockedByGuard.code, reason: page._blockedByGuard.reason };
    }

    return classifyLiveness({
      status,
      requestedUrl: url,
      finalUrl,
      bodyText: bodyText + frameText,
      applyControls,
    });
  } catch (err) {
    if (page && page._blockedByGuard) {
      return { result: 'uncertain', code: page._blockedByGuard.code, reason: page._blockedByGuard.reason };
    }
    // Transient failures (timeout, DNS, TLS, 5xx) shouldn't be treated as expired —
    // doing so would cause scan --verify to drop the URL and write it to scan-history,
    // permanently filtering it out on subsequent scans.
    return {
      result: 'uncertain',
      code: 'navigation_error',
      reason: `navigation error: ${err.message.split('\n')[0]}`,
    };
  }
}

// Anti-bot results that a headed browser may be able to get past. A real (headed)
// Chromium clears the JS/Cloudflare challenge that headless trips on (e.g. pracuj.pl).
const CHALLENGE_CODES = new Set(['bot_challenge', 'access_blocked']);

export function isChallengeResult(result) {
  return result?.result === 'uncertain' && CHALLENGE_CODES.has(result.code);
}

// Lazily owns a single headed browser/page, created only on first use and reused
// across URLs. Headed Chromium needs a display, so launch can fail in headless/CI
// environments — in that case get() returns null and callers degrade to the
// headless result (challenge stays uncertain, never falsely expired).
export function createHeadedPageProvider(chromium) {
  let browser = null;
  let page = null;
  let launchFailed = false;
  return {
    async get() {
      if (page) return page;
      if (launchFailed) return null;
      try {
        browser = await chromium.launch({ headless: false, ...BROWSER_EGRESS_LAUNCH_OPTIONS });
        const context = await newGuardedBrowserContext(browser, LIVENESS_CONTEXT_OPTIONS);
        page = await context.newPage();
        return page;
      } catch {
        launchFailed = true;
        try { await browser?.close(); } catch { /* best-effort teardown */ }
        browser = null;
        page = null;
        return null;
      }
    },
    async close() {
      if (browser) {
        try {
          await browser.close();
        } catch {
          // best-effort teardown
        }
      }
      browser = null;
      page = null;
    },
  };
}

// Runs the headless check, then retries once in a headed browser if the page was
// blocked by an anti-bot wall. The headed result wins when it actually sees the
// page; if the retry is still blocked (or no headed page is available) the
// original uncertain result is kept — we never upgrade a block to expired.
export async function checkUrlLivenessWithFallback(page, url, { getHeadedPage } = {}) {
  const first = await checkUrlLiveness(page, url);
  if (!getHeadedPage || !isChallengeResult(first)) {
    return first;
  }
  const headedPage = await getHeadedPage();
  if (!headedPage) {
    return first;
  }
  const second = await checkUrlLiveness(headedPage, url, { extraSettleMs: 3_000 });
  if (isChallengeResult(second)) {
    return { ...second, reason: `${second.reason} (headed retry also blocked)` };
  }
  return second;
}
