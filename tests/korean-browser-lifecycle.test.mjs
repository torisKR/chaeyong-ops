import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readJobPage } from '../lib/job-browser.mjs';
import { fetchJobPage } from '../openrouter-runner.mjs';

test('browser failures close sessions and the shared queue recovers without plain-fetch fallback', async () => {
  const url = 'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=12345';
  let launches = 0, closes = 0, live = 0, peak = 0;
  const launchBrowser = failure => async options => {
    assert.equal(options.headless, true);
    launches++;
    live++;
    peak = Math.max(peak, live);
    return {
      newContext: async () => ({
        route: async () => {},
        newPage: async () => ({
          goto: async () => {
            if (failure === 'navigation') throw new Error('synthetic navigation failure');
            return { status: () => 200 };
          },
          waitForTimeout: async () => {},
          url: () => url,
          evaluate: async () => {
            if (failure === 'DOM') throw new Error('synthetic DOM failure');
            return {
              title: '백엔드 개발자',
              text: 'Python 개발자 모집 '.repeat(40),
              bodyText: 'Python 개발자 모집 '.repeat(40),
              applyControls: ['지원하기'],
              jobs: [],
            };
          },
          frames: () => [],
          mainFrame: () => null,
        }),
      }),
      close: async () => { closes++; live--; },
    };
  };
  for (const failure of ['navigation', 'DOM']) {
    await assert.rejects(readJobPage(url, { launchBrowser: launchBrowser(failure), settleMs: 0 }), /synthetic/);
    assert.equal(live, 0, `${failure} failure must close its browser`);
    assert.equal(closes, launches);
  }
  const recovered = await Promise.all([1, 2].map(() => readJobPage(url, { launchBrowser: launchBrowser(), settleMs: 0 })));
  assert.ok(recovered.every(page => page.liveness.result === 'active'));
  assert.equal(launches, 4);
  assert.equal(closes, launches);
  assert.equal(live, 0);
  assert.equal(peak, 1, 'concurrent callers must not share or overlap sessions');

  const originalFetch = globalThis.fetch;
  let plainFetchCalls = 0;
  try {
    globalThis.fetch = async () => { plainFetchCalls++; throw new Error('unexpected plain fetch'); };
    await assert.rejects(fetchJobPage(url, async () => { throw new Error('synthetic reader failure'); }), /synthetic reader failure/);
    await assert.rejects(fetchJobPage(url, async () => ({
      text: '로그인이 필요합니다',
      liveness: { result: 'uncertain', code: 'login_required', reason: 'login required' },
    })), /Posting unverified: login_required/);
    assert.equal(plainFetchCalls, 0, 'unverified/browser-failed content must not fall back to plain fetch');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
