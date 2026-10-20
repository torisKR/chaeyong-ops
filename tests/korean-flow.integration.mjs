// Explicit integration entry point: real Chromium, synthetic candidate and model.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { readJobPage } from '../lib/job-browser.mjs';
import jobkorea from '../providers/jobkorea.mjs';
import saramin from '../providers/saramin.mjs';
import { prepareApplication, updatePreparedTracker } from '../lib/application-prep.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const root = process.env.CAREER_OPS_TEST_ARTIFACTS || fs.mkdtempSync('/private/tmp/chaeyong-kr-');
fs.mkdirSync(root, { recursive: true });
process.env.CAREER_OPS_ROOT = root;
process.env.CAREER_OPS_DATA_DIR = root;
delete process.env.CAREER_OPS_TRACKER;
for (const dir of ['config', 'modes', 'reports', 'data']) fs.mkdirSync(path.join(root, dir), { recursive: true });
const cv = '# 가상 지원자\n\n## Summary\n백엔드 개발자. Python API 개발 경험.\n\n## Experience\n가상연구소 백엔드 개발자. Python API 개발.\n\n## Education\n가상대학교 컴퓨터공학 학사.\n\n## Skills\nPython\n';
fs.writeFileSync(path.join(root, 'cv.md'), cv);
fs.writeFileSync(path.join(root, 'config/profile.yml'), 'name: 가상 지원자\nlanguage:\n  output: ko\n  modes_dir: modes/ko\ncv:\n  template: ko-standard\n');
fs.writeFileSync(path.join(root, 'modes/_profile.md'), '가상 검증 자료입니다. 백엔드 개발자 역할을 대상으로 합니다.');
const { cmdEvaluate, cmdApply, cmdPipeline, loadContext } = await import('../openrouter-runner.mjs');
const ctx = loadContext();
const jd = '가상회사 백엔드 개발자\n주요업무: Python API 개발\n자격요건: Python 경험\n근무지: 서울 강남구\n채용시 마감\n지원하기';
let inFlight = 0, peak = 0, closed = 0;
const launchBrowser = async opts => {
  inFlight++; peak = Math.max(peak, inFlight);
  const browser = await chromium.launch(opts);
  const originalClose = browser.close.bind(browser);
  browser.close = async () => { await originalClose(); closed++; inFlight--; };
  return browser;
};
const jobCard = id => `<div data-sentry-component="CardJob"><a data-sentry-component="CompanyLogo" href="/Recruit/GI_Read/${id}"><img alt="가상회사 로고"></a><a data-sentry-component="Title" href="/Recruit/GI_Read/${id}"><span>백엔드 개발자</span></a><div data-sentry-component="GrayChip"><span class="emoji--basicemoji-place2"></span><span>서울 강남구</span></div></div>`;
const sarCard = id => `<div class="item_recruit"><div class="corp_name"><a>가상회사</a></div><h2 class="job_tit"><a title="백엔드 개발자" href="/zf_user/jobs/relay/view?rec_idx=${id}">백엔드 개발자</a></h2><div class="job_condition"><span>서울 강남구</span></div></div>`;
const setupContext = async context => {
  await context.route('**/*', route => {
    const u = new URL(route.request().url());
    let html;
    if (u.pathname.includes('Search')) {
      const n = u.searchParams.get('Page_No');
      html = n === '1' ? jobCard('12345') + jobCard('12345') : n === '2' ? jobCard('67890') : '';
    } else if (u.pathname.includes('search')) html = sarCard('12345') + sarCard('12345');
    else if (u.pathname.includes('blocked')) html = '<p>보안 확인을 완료해 주세요</p>';
    else if (u.pathname.includes('login')) html = '<p>로그인이 필요합니다</p>';
    else if (u.pathname.includes('closed')) html = '<p>본 채용공고는 마감되었습니다</p><button>지원하기</button>';
    else html = `<main><h1>백엔드 개발자</h1><pre>${jd}</pre><button>지원하기</button><button disabled>입사지원</button></main>`;
    // Hydration regression: cards do not exist in the initial HTML.
    const body = html ? `<script>setTimeout(()=>document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(html)}), 200)</script>` : '<p>검색 결과 없음</p>';
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><nav><a href="/Recruit/GI_Read/99999">추천 링크</a></nav>${body}` });
  });
};
const read = (url, options = {}) => readJobPage(url, { ...options, launchBrowser, setupContext, settleMs: 350, timeout: 1500 });
const rows = await jobkorea.fetch({ max_pages: 3 }, { readJobPage: read, sleep: async () => {} });
assert.equal(rows.length, 2);
assert.deepEqual(rows.map(r => r.id), ['12345', '67890']);
assert.equal(rows[0].company, '가상회사'); assert.equal(rows[0].location, '서울 강남구');
assert.equal((await saramin.fetch({ max_pages: 1 }, { readJobPage: read })).length, 1);
await Promise.all([read(rows[0].url), read(rows[1].url)]);
assert.equal(peak, 1, 'all Korean visits serialized');
for (const [suffix, result] of [['blocked', 'uncertain'], ['login', 'uncertain'], ['closed', 'expired']]) {
  assert.equal((await read(`https://www.saramin.co.kr/${suffix}`)).liveness.result, result);
}
const summary = '## Machine Summary\n\n```yaml\ncompany: 가상회사\nrole: 백엔드 개발자\nscore: 4.2\nlegitimacy_tier: Proceed with Caution\nfinal_decision: Consider\n```\n\n## 분석\nPython 경험과 연결됩니다.';
const before = fs.readdirSync(path.join(root, 'reports'));
assert.equal(await cmdEvaluate('https://www.saramin.co.kr/blocked', ctx, { readPage: read, generate: () => { throw new Error('must not call model'); } }), null);
assert.equal(await cmdEvaluate(rows[0].url, ctx, { readPage: read, generate: async () => { throw new Error('synthetic model failure'); } }), null);
await assert.rejects(cmdEvaluate(rows[0].url, ctx, { readPage: read, generate: async () => ({ content: summary.replace('4.2', '8') }) }), /score/);
assert.deepEqual(fs.readdirSync(path.join(root, 'reports')), before);
const observed = await read(rows[0].url, { screenshot: path.join(root, 'fixture-detail.png') });
let evaluationCalls = 0;
const evaluateOptions = {readPage:async()=>observed, generate:async()=>{evaluationCalls++;return {content:summary};}};
const [report, concurrentReport] = await Promise.all([cmdEvaluate(rows[0].url,ctx,evaluateOptions),cmdEvaluate(rows[0].url,ctx,evaluateOptions)]);
assert.equal(report,concurrentReport); assert.equal(evaluationCalls,1,'concurrent retry generates one report');
assert.ok(fs.readFileSync(path.join(root, report), 'utf8').endsWith(observed.text + '\n'));
assert.equal(await cmdEvaluate(rows[0].url, ctx, { generate: () => { throw new Error('duplicate model call'); } }), report);
const candidate = { candidate: { name: '가상 지원자' }, lang: 'ko', summary: '백엔드 개발자. Python API 개발 경험.', experience: [{company: '가상연구소', role: '백엔드 개발자', bullets: ['Python API 개발.']}], education: [{title: '컴퓨터공학 학사', org: '가상대학교'}], skills: [{category: '기술', items: ['Python']}] };
const generate = async () => ({content: JSON.stringify({ cv: candidate, answers: 'Python API 개발 경험을 바탕으로 지원합니다.' })});
await assert.rejects(prepareApplication({root, reportPath: report, context: ctx, generate: async () => ({content: JSON.stringify({cv: {...candidate, summary: 'Improved throughput by 999%.'}, answers: 'test'})})}), /Fact check/);
await assert.rejects(prepareApplication({root, reportPath: report, context: ctx, generate, renderPdf: async () => { throw new Error('synthetic renderer failure'); }}), /renderer/);
const dir = path.join(root, 'output', path.basename(report, '.md'));
assert.equal(fs.existsSync(path.join(dir, 'prepared.json')), false);
assert.equal(fs.readFileSync(path.join(root, 'data/applications.md'), 'utf8').includes('[PDF]'), false);
const receipt = await cmdApply('1', ctx, { generate: async (_system, prompt) => generate(prompt) });
assert.equal(receipt.status, 'prepared');
assert.ok(fs.statSync(path.join(root, receipt.pdf)).size > 1000);
assert.equal((await cmdApply('1', ctx, { generate: () => { throw new Error('duplicate apply call'); }})).status, 'prepared');
const tracker = fs.readFileSync(path.join(root, 'data/applications.md'), 'utf8');
assert.equal((tracker.match(/\| 1 \|/g) || []).length, 1);
assert.ok(tracker.includes('| Evaluated | [PDF]'));
assert.ok(tracker.includes('](../reports/'));
assert.ok(tracker.includes('](../output/'));
const oldBundle = Object.fromEntries(['cv.json','cv.html','cv.pdf','answers.md','prepared.json'].map(f => [f, fs.readFileSync(path.join(dir,f))]));
await assert.rejects(prepareApplication({root, reportPath: report, context: {...ctx, custom:'changed instructions'}, generate, renderPdf: async () => {throw new Error('retry PDF failure');}}), /retry PDF failure/);
for (const [f, bytes] of Object.entries(oldBundle)) assert.deepEqual(fs.readFileSync(path.join(dir,f)), bytes, 'failed retry preserves '+f);
await assert.rejects(prepareApplication({root, reportPath:report, context:{...ctx,custom:'manifest failure'}, generate, publishManifest:async()=>{throw new Error('manifest failure')}}), /manifest failure/);
for (const [f, bytes] of Object.entries(oldBundle)) assert.deepEqual(fs.readFileSync(path.join(dir,f)), bytes, 'late failure preserves '+f);
// Report numbers and tracker row numbers are independent.
fs.writeFileSync(path.join(root, 'data/applications.md'), tracker.replace('| 1 |', '| 77 |').replace('[001]', '[리포트]'));
await updatePreparedTracker(root, {num:1, report, summary:{}, pdf:receipt.pdf});
assert.ok(fs.readFileSync(path.join(root, 'data/applications.md'),'utf8').includes('| 77 |'));
// Pipeline exceptions must leave entries pending and report failure.
fs.writeFileSync(path.join(root,'data/pipeline.md'), '- [ ] https://example.com/job/12345 | 가상회사 | 백엔드 개발자\n');
const result = await cmdPipeline(ctx, {evaluate:async()=>{throw new Error('invalid summary')}, delayMs:0});
assert.equal(result.failed,1); assert.equal(process.exitCode,1);
assert.ok(fs.readFileSync(path.join(root,'data/pipeline.md'),'utf8').startsWith('- [ ]'));
process.exitCode = 0;
// A tracker elsewhere must not move artifacts outside the selected data root.
const external = fs.mkdtempSync('/private/tmp/chaeyong-tracker-');
process.env.CAREER_OPS_TRACKER = path.join(external, 'applications.md');
await updatePreparedTracker(root, {num:1, report, summary:{company:'가상회사',role:'백엔드 개발자',score:4.2}});
const other = await prepareApplication({root, reportPath:report, context:{...ctx,custom:'external tracker'}, generate});
assert.ok(fs.existsSync(path.join(root,other.pdf)));
assert.ok(fs.readFileSync(process.env.CAREER_OPS_TRACKER,'utf8').includes('[PDF]'));
delete process.env.CAREER_OPS_TRACKER;
// Distinct posting identities survive canonical company+role fuzzy dedup.
const second = 'reports/002-가상회사-other.md';
fs.writeFileSync(path.join(root,second), '**URL:** https://www.jobkorea.co.kr/Recruit/GI_Read/67890\n'+summary);
await updatePreparedTracker(root,{num:2,report:second,summary:{company:'가상회사',role:'백엔드 개발자',score:4.2}});
assert.ok(fs.readFileSync(path.join(root,'data/applications.md'),'utf8').includes('002-가상회사-other.md'));
assert.equal(inFlight, 0); assert.ok(closed > 0);
fs.writeFileSync(path.join(root, 'verification.json'), JSON.stringify({status: 'passed', synthetic: true, browser: 'Chromium', visits: closed, peakConcurrency: peak, report, receipt, assertions: ['hydration', 'pagination', 'dedup', 'company-location', 'Korean-liveness', 'blocked', 'model-failure', 'invalid-score', 'JD-verbatim', 'fact-failure', 'PDF-failure', 'HTML-PDF-answers-tracker', 'idempotent', 'preserve-previous-bundle-on-render-and-manifest-failure', 'independent-tracker-root', 'pipeline-failure-exit', 'canonical-relative-links'], observedAt: new Date().toISOString()}, null, 2));
console.log(`Integration passed. Synthetic artifacts: ${root}`);
