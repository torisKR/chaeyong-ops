import { pass, fail, ROOT } from '../helpers.mjs';
import { join } from 'path';
import { pathToFileURL } from 'url';

console.log('\nProvider — jobkorea');

const mod = await import(pathToFileURL(join(ROOT, 'providers/jobkorea.mjs')).href);
const jobkorea = mod.default;
const { parseJobkoreaSearchPage, buildJobkoreaSearchUrl } = mod;

if (jobkorea.id === 'jobkorea') pass('jobkorea.id is "jobkorea"');
else fail(`jobkorea.id is ${JSON.stringify(jobkorea.id)}`);

const searchUrl = buildJobkoreaSearchUrl('python', 3);
if (searchUrl.includes('stext=python') && searchUrl.includes('Page_No=3')) {
  pass('buildJobkoreaSearchUrl encodes keyword and page');
} else {
  fail(`buildJobkoreaSearchUrl = ${searchUrl}`);
}

const modernHtml = `
<div data-sentry-component="CardJob">
  <img alt="테스트회사 로고" />
  <a href="https://www.jobkorea.co.kr/Recruit/GI_Read/11111" data-sentry-component="Title">시니어 백엔드 엔지니어</a>
</div>`;

const rows = parseJobkoreaSearchPage(modernHtml);
if (rows.length === 1 && rows[0].title === '시니어 백엔드 엔지니어' && rows[0].company === '테스트회사') {
  pass('parseJobkoreaSearchPage parses modern CardJob markup');
} else {
  fail(`parseJobkoreaSearchPage modern = ${JSON.stringify(rows)}`);
}

const legacyHtml =
  '<a href="/Recruit/GI_Read/22222" onclick="GA_Event(\'채용\', \'추천\', \'레거시 공고\')">레거시</a>';
const legacyRows = parseJobkoreaSearchPage(legacyHtml);
if (legacyRows.length === 1 && legacyRows[0].title === '레거시 공고') {
  pass('parseJobkoreaSearchPage parses legacy onclick markup');
} else {
  fail(`parseJobkoreaSearchPage legacy = ${JSON.stringify(legacyRows)}`);
}
