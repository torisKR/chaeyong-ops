// tests/portals-kr.example.test.mjs — Korean scanner template stays operational.
import { pass, fail, ROOT } from './helpers.mjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import * as yaml from 'js-yaml';
import { buildTitleFilter } from '../title-keywords.mjs';

console.log('\nportals-kr.example.yml — Korean backend/fullstack boards');

const path = join(ROOT, 'templates', 'portals-kr.example.yml');
const raw = readFileSync(path, 'utf-8');
const doc = yaml.load(raw);
const boards = Array.isArray(doc?.job_boards) ? doc.job_boards : [];

const JUNIOR_TENURE_NEGATIVES = [
  '3~5년',
  '3년 이상',
  '4~7년',
  '5년 이상',
  '시니어',
  'Senior',
  '리드',
  'Lead',
  '팀장',
];

const wantedKeywords = boards
  .filter((b) => b?.provider === 'wanted' && b?.enabled === true)
  .map((b) => String(b.searchKeywords || '').trim());
const required = ['백엔드', 'NestJS', 'Node.js', '풀스택', 'TypeScript'];
const missing = required.filter((k) => !wantedKeywords.includes(k));
if (missing.length === 0) {
  pass(`enabled Wanted boards cover ${required.join(', ')}`);
} else {
  fail(`Wanted enabled keywords missing ${JSON.stringify(missing)}; have ${JSON.stringify(wantedKeywords)}`);
}

const remember = boards.find((b) => b?.provider === 'remember');
if (remember && remember.enabled === false && /rememberapp\.co\.kr/.test(String(remember.careers_url || ''))) {
  pass('Remember stub is present and disabled by default');
} else {
  fail(`Remember stub missing or enabled: ${JSON.stringify(remember)}`);
}

const saramin = boards.find((b) => b?.provider === 'saramin');
const jobkorea = boards.find((b) => b?.provider === 'jobkorea');
if (saramin?.enabled === false && jobkorea?.enabled === false) {
  pass('Saramin and JobKorea ship disabled (ToS gate)');
} else {
  fail('Saramin/JobKorea should default to enabled: false');
}

const titlePos = doc?.title_filter?.positive || [];
if (required.every((k) => titlePos.includes(k) || titlePos.some((t) => String(t).includes(k.replace('.js', ''))))) {
  pass('title_filter.positive includes backend/fullstack keywords');
} else {
  fail(`title_filter.positive = ${JSON.stringify(titlePos)}`);
}

const titleNeg = (doc?.title_filter?.negative || []).map((k) => String(k));
const missingTenure = JUNIOR_TENURE_NEGATIVES.filter((k) => !titleNeg.includes(k));
if (missingTenure.length === 0) {
  pass('title_filter.negative documents high-tenure title bands for junior targeting');
} else {
  fail(`title_filter.negative missing tenure bands ${JSON.stringify(missingTenure)}; have ${JSON.stringify(titleNeg)}`);
}

const titleFilter = buildTitleFilter(doc.title_filter);
const rejectedTitles = [
  '백엔드 개발자 (3~5년)',
  '백엔드 (3년 이상)',
  '풀스택 개발자 (4~7년)',
  'Node.js 개발자 (5년 이상)',
  '시니어 백엔드',
  'Senior Backend Engineer',
  '백엔드 리드',
  'Tech Lead',
  '개발 팀장',
];
const leaked = rejectedTitles.filter((t) => titleFilter(t));
if (leaked.length === 0) {
  pass('example title_filter rejects high-tenure / senior title bands');
} else {
  fail(`tenure negatives leaked through: ${JSON.stringify(leaked)}`);
}

const keepers = ['백엔드 개발자', '주니어 풀스택', 'NestJS 개발자 (1~2년)'];
const dropped = keepers.filter((t) => !titleFilter(t));
if (dropped.length === 0) {
  pass('example title_filter keeps junior / unbanded backend titles');
} else {
  fail(`junior titles were vetoed: ${JSON.stringify(dropped)}`);
}

const shared = readFileSync(join(ROOT, 'modes', 'ko', '_shared.md'), 'utf-8');
const gonggo = readFileSync(join(ROOT, 'modes', 'ko', 'gonggo.md'), 'utf-8');
const applyKr = readFileSync(join(ROOT, 'docs', 'APPLY-KR.md'), 'utf-8');
const hasYearGate = /2년 미만/.test(shared) && /3년/.test(shared) && /연차를 부풀리지|연차에 더하지/.test(shared);
const hasSeniorityGate = /리드|아키텍트|팀장/.test(shared) && /SKIP/.test(shared);
const gonggoSkip = /경력 밴드 게이트/.test(gonggo) && /SKIP/.test(gonggo);
const docsDualGate = /경력 연차 \+ 프로젝트 시니어티 둘 다 게이트/.test(applyKr);
if (hasYearGate && hasSeniorityGate && gonggoSkip && docsDualGate) {
  pass('scoring + APPLY-KR docs gate both career years and project seniority');
} else {
  fail(`junior-band docs incomplete: year=${hasYearGate} seniority=${hasSeniorityGate} gonggo=${gonggoSkip} apply=${docsDualGate}`);
}

const validated = spawnSync(process.execPath, ['validate-portals.mjs', '--file', 'templates/portals-kr.example.yml'], {
  cwd: ROOT,
  encoding: 'utf-8',
  timeout: 30_000,
});
if (validated.status === 0) pass('validate-portals accepts templates/portals-kr.example.yml');
else fail(`validate-portals.kr exit ${validated.status}: ${(validated.stderr || validated.stdout || '').slice(0, 400)}`);
