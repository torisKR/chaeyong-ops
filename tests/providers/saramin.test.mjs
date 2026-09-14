import { pass, fail, ROOT } from '../helpers.mjs';
import { join } from 'path';
import { pathToFileURL } from 'url';

console.log('\nProvider — saramin');

const mod = await import(pathToFileURL(join(ROOT, 'providers/saramin.mjs')).href);
const saramin = mod.default;
const { parseSaraminSearchPage, buildSaraminSearchUrl } = mod;

if (saramin.id === 'saramin') pass('saramin.id is "saramin"');
else fail(`saramin.id is ${JSON.stringify(saramin.id)}`);

const searchUrl = buildSaraminSearchUrl('python', 2);
if (searchUrl.includes('searchword=python') && searchUrl.includes('recruitPage=2')) {
  pass('buildSaraminSearchUrl encodes keyword and page');
} else {
  fail(`buildSaraminSearchUrl = ${searchUrl}`);
}

const html = `
<h2 class="job_tit">
  <a target="_blank" title="백엔드 개발자" href="/zf_user/jobs/relay/view?rec_idx=12345">백엔드</a>
</h2>
<h2 class="job_tit">
  <a target="_blank" title="데이터 엔지니어" href="/zf_user/jobs/relay/view?rec_idx=67890">데이터</a>
</h2>`;

const rows = parseSaraminSearchPage(html, 'Saramin KR');
if (rows.length === 2 && rows[0].title === '백엔드 개발자' && rows[0].url.includes('rec_idx=12345')) {
  pass('parseSaraminSearchPage extracts title and rec_idx');
} else {
  fail(`parseSaraminSearchPage = ${JSON.stringify(rows)}`);
}
