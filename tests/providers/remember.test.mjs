import { pass, fail, ROOT } from '../helpers.mjs';
import { join } from 'path';
import { pathToFileURL } from 'url';

console.log('\nProvider — remember');

const mod = await import(pathToFileURL(join(ROOT, 'providers/remember.mjs')).href);
const remember = mod.default;
const {
  buildRememberListUrl,
  parseRememberSearchPage,
  isRememberChallengePage,
  CHALLENGE_MESSAGE,
  SPA_EMPTY_MESSAGE,
} = mod;

if (remember.id === 'remember') pass('remember.id is "remember"');
else fail(`remember.id is ${JSON.stringify(remember.id)}`);

const hit = remember.detect({ name: 'Remember', provider: 'remember' });
if (hit && hit.url === 'https://career.rememberapp.co.kr/job/postings') {
  pass('remember.detect() resolves provider:remember → listing URL');
} else {
  fail(`remember.detect() returned ${JSON.stringify(hit)}`);
}
if (remember.detect({ name: 'Remember' }) === null) pass('remember.detect() returns null without provider:remember');
else fail('remember.detect() should require provider:remember');

if (buildRememberListUrl(1) === 'https://career.rememberapp.co.kr/job/postings') {
  pass('buildRememberListUrl(1) is the bare listing path');
} else {
  fail(`buildRememberListUrl(1) = ${buildRememberListUrl(1)}`);
}

const page2 = buildRememberListUrl(2);
if (page2 === 'https://career.rememberapp.co.kr/job/postings?page=2' && !page2.includes('seed=')) {
  pass('buildRememberListUrl(2) paginates without seed=');
} else {
  fail(`buildRememberListUrl(2) = ${page2}`);
}

const anchorHtml = `
<a href="https://career.rememberapp.co.kr/job/postings/12345">NestJS 백엔드 개발자</a>
<a href="/job/postings/67890">풀스택 개발자 (React/Next.js)</a>
<a href="https://career.rememberapp.co.kr/job/postings/12345">duplicate</a>
`;
const anchors = parseRememberSearchPage(anchorHtml, 'Remember KR');
if (
  anchors.length === 2 &&
  anchors[0].title === 'NestJS 백엔드 개발자' &&
  anchors[0].url === 'https://career.rememberapp.co.kr/job/postings/12345' &&
  anchors[1].title === '풀스택 개발자 (React/Next.js)' &&
  anchors[1].company === 'Remember KR'
) {
  pass('parseRememberSearchPage extracts posting anchors and dedups');
} else {
  fail(`parseRememberSearchPage anchors = ${JSON.stringify(anchors)}`);
}

if (
  parseRememberSearchPage('<a href="/job/postings/1">Backend &amp; API</a>')[0]?.title === 'Backend & API'
) {
  pass('parseRememberSearchPage decodes HTML entities in titles');
} else {
  fail('parseRememberSearchPage should decode &amp; in titles');
}

const surrogateHtml = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  jobs: [
    { id: '\uD800bad', title: 'Bad Id' },
    { id: 'ok-2', title: 'Good Id' },
  ],
})}</script>`;
const surrogateRows = parseRememberSearchPage(surrogateHtml);
if (surrogateRows.length === 1 && surrogateRows[0].url.endsWith('/job/postings/ok-2')) {
  pass('parseRememberSearchPage drops a lone-surrogate id and keeps the rest');
} else {
  fail(`parseRememberSearchPage surrogate = ${JSON.stringify(surrogateRows)}`);
}

const once = [];
await remember.fetch({ name: 'Remember', provider: 'remember', max_pages: 9 }, {
  maxPages: 1,
  fetchText: async (url) => {
    once.push(url);
    return '<a href="/job/postings/1">공고</a>';
  },
});
if (once.length === 1 && once[0] === 'https://career.rememberapp.co.kr/job/postings') {
  pass('remember.fetch honours ctx.maxPages: 1');
} else {
  fail(`remember.fetch maxPages = ${JSON.stringify(once)}`);
}

const ldHtml = `
<script type="application/ld+json">
{"@type":"JobPosting","title":"시니어 백엔드 엔지니어","url":"https://career.rememberapp.co.kr/job/postings/abc-1","hiringOrganization":{"name":"테스트컴퍼니"},"jobLocation":{"address":{"addressLocality":"서울"}}}
</script>`;
const ldRows = parseRememberSearchPage(ldHtml);
if (
  ldRows.length === 1 &&
  ldRows[0].title === '시니어 백엔드 엔지니어' &&
  ldRows[0].company === '테스트컴퍼니' &&
  ldRows[0].location === '서울' &&
  ldRows[0].url === 'https://career.rememberapp.co.kr/job/postings/abc-1'
) {
  pass('parseRememberSearchPage reads JSON-LD JobPosting');
} else {
  fail(`parseRememberSearchPage JSON-LD = ${JSON.stringify(ldRows)}`);
}

const nextHtml = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: {
    pageProps: {
      jobs: [{ id: '999', title: 'Node.js 백엔드', companyName: '넥스트사', location: '판교' }],
    },
  },
})}</script>`;
const nextRows = parseRememberSearchPage(nextHtml);
if (
  nextRows.length === 1 &&
  nextRows[0].title === 'Node.js 백엔드' &&
  nextRows[0].company === '넥스트사' &&
  nextRows[0].location === '판교' &&
  nextRows[0].url === 'https://career.rememberapp.co.kr/job/postings/999'
) {
  pass('parseRememberSearchPage walks __NEXT_DATA__ job objects');
} else {
  fail(`parseRememberSearchPage NEXT_DATA = ${JSON.stringify(nextRows)}`);
}

const challengeHtml = '<html><h1>Sorry, you have been blocked</h1><div class="cf-error-details"></div></html>';
if (isRememberChallengePage(challengeHtml) && !isRememberChallengePage(anchorHtml)) {
  pass('isRememberChallengePage detects Cloudflare interstitials');
} else {
  fail('isRememberChallengePage misclassified HTML');
}

const challengeErr = new Error('HTTP 403');
challengeErr.status = 403;
try {
  await remember.fetch({ name: 'Remember', provider: 'remember' }, {
    fetchText: async () => {
      throw challengeErr;
    },
  });
  fail('remember.fetch should throw on HTTP 403');
} catch (err) {
  if (err.message === CHALLENGE_MESSAGE) pass('remember.fetch wraps HTTP 403 as the named challenge error');
  else fail(`remember.fetch 403 message = ${err.message}`);
}

try {
  await remember.fetch({ name: 'Remember', provider: 'remember' }, {
    fetchText: async () => challengeHtml,
  });
  fail('remember.fetch should throw on challenge HTML');
} catch (err) {
  if (err.message === CHALLENGE_MESSAGE) pass('remember.fetch throws on challenge HTML even when status is 200');
  else fail(`remember.fetch challenge HTML message = ${err.message}`);
}

try {
  await remember.fetch({ name: 'Remember', provider: 'remember' }, {
    fetchText: async () => '<html><body>empty spa shell</body></html>',
  });
  fail('remember.fetch should throw when page 1 parses to nothing');
} catch (err) {
  if (err.message === SPA_EMPTY_MESSAGE) pass('remember.fetch throws SPA_EMPTY_MESSAGE on an empty first page');
  else fail(`remember.fetch empty page message = ${err.message}`);
}

const seen = [];
const jobs = await remember.fetch({ name: 'Remember', provider: 'remember', max_pages: 2 }, {
  sleep: async () => {},
  fetchText: async (url, opts) => {
    seen.push({ url, redirect: opts?.redirect });
    if (String(url).includes('page=2')) {
      return '<a href="/job/postings/2">두 번째 공고</a>';
    }
    return '<a href="/job/postings/1">첫 공고</a>';
  },
});
if (
  jobs.length === 2 &&
  jobs[0].url.endsWith('/job/postings/1') &&
  jobs[1].url.endsWith('/job/postings/2') &&
  seen.every((s) => s.redirect === 'error') &&
  seen.every((s) => !String(s.url).includes('seed='))
) {
  pass('remember.fetch paginates with redirect:error and no seed=');
} else {
  fail(`remember.fetch pagination = ${JSON.stringify({ jobs, seen })}`);
}

const pinned = [];
const pinnedJobs = await remember.fetch(
  { name: 'Evil', careers_url: 'https://evil.example/', provider: 'remember' },
  {
    fetchText: async (url) => {
      pinned.push(url);
      return '<a href="/job/postings/1">공고</a>';
    },
  },
);
if (
  pinned.length >= 1 &&
  pinned.every((u) => String(u).startsWith('https://career.rememberapp.co.kr/job/postings')) &&
  pinnedJobs[0]?.url === 'https://career.rememberapp.co.kr/job/postings/1'
) {
  pass('remember.fetch ignores untrusted careers_url and stays on the pinned host');
} else {
  fail(`remember.fetch pinned host = ${JSON.stringify({ pinned, pinnedJobs })}`);
}
