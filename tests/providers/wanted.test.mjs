import { pass, fail, ROOT } from '../helpers.mjs';
import { join } from 'path';
import { pathToFileURL } from 'url';

console.log('\nProvider — wanted');

const mod = await import(pathToFileURL(join(ROOT, 'providers/wanted.mjs')).href);
const wanted = mod.default;
const { normalizeWantedJob, buildWantedApiUrl } = mod;

if (wanted.id === 'wanted') pass('wanted.id is "wanted"');
else fail(`wanted.id is ${JSON.stringify(wanted.id)}`);

const url = buildWantedApiUrl('백엔드', 20, 0);
if (url.includes('keyword=') && url.startsWith('https://www.wanted.co.kr/api/v4/jobs')) {
  pass('buildWantedApiUrl builds expected API URL');
} else {
  fail(`buildWantedApiUrl = ${url}`);
}

const job = normalizeWantedJob(
  {
    id: 12345,
    position: '  백엔드 엔지니어  ',
    company: { name: '  테스트컴퍼니  ' },
    address: { location: '서울', district: '강남구' },
  },
  'Fallback',
);
if (
  job &&
  job.title === '백엔드 엔지니어' &&
  job.url === 'https://www.wanted.co.kr/wd/12345' &&
  job.company === '테스트컴퍼니' &&
  job.location === '서울 강남구'
) {
  pass('normalizeWantedJob maps fields correctly');
} else {
  fail(`normalizeWantedJob = ${JSON.stringify(job)}`);
}

if (normalizeWantedJob({ id: 1 }) === null) pass('normalizeWantedJob drops rows without title');
else fail('normalizeWantedJob should drop rows without title');
