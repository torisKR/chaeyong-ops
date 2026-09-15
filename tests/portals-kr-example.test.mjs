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

const PROFILE_DERIVED_TENURE = [
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
const hardcodedTenure = PROFILE_DERIVED_TENURE.filter((k) => titleNeg.includes(k));
if (hardcodedTenure.length === 0) {
  pass('example title_filter does not hardcode tenure bands (profile.years selects them)');
} else {
  fail(`portals-kr.example.yml still hardcodes tenure negatives: ${JSON.stringify(hardcodedTenure)}`);
}

if (/experience\.years/.test(raw) && /experience-band/.test(raw)) {
  pass('portals-kr.example.yml documents profile-driven tenure negatives');
} else {
  fail('portals-kr.example.yml should point title-band negatives at experience.years');
}

const titleFilter = buildTitleFilter(doc.title_filter);
if (titleFilter('시니어 백엔드') && titleFilter('백엔드 (3년 이상)') && titleFilter('백엔드 개발자')) {
  pass('shipped example without a profile keeps senior / 3년+ titles (no invented junior band)');
} else {
  fail('example title_filter vetoed a title it should leave for experience.years');
}

const profileEx = yaml.load(readFileSync(join(ROOT, 'config', 'profile.example.yml'), 'utf-8'));
const expYears = profileEx?.experience?.years;
if (typeof expYears === 'number' && Number.isFinite(expYears)) {
  pass(`config/profile.example.yml documents experience.years (${expYears})`);
} else {
  fail(`profile.example.yml missing experience.years: ${JSON.stringify(profileEx?.experience)}`);
}

const shared = readFileSync(join(ROOT, 'modes', 'ko', '_shared.md'), 'utf-8');
const gonggo = readFileSync(join(ROOT, 'modes', 'ko', 'gonggo.md'), 'utf-8');
const applyKr = readFileSync(join(ROOT, 'docs', 'APPLY-KR.md'), 'utf-8');
const profileDriven = /experience\.years/.test(shared) && !/주니어 경력 밴드 게이트 \(~1–2년\)/.test(shared);
const gonggoSkip = /experience\.years/.test(gonggo) && /SKIP/.test(gonggo);
const docsProfile = /experience\.years/.test(applyKr) && /고정 주니어/.test(applyKr);
if (profileDriven && gonggoSkip && docsProfile) {
  pass('scoring + APPLY-KR docs are profile-driven (not a fixed under-2y band)');
} else {
  fail(`profile-driven docs incomplete: shared=${profileDriven} gonggo=${gonggoSkip} apply=${docsProfile}`);
}

const validated = spawnSync(process.execPath, ['validate-portals.mjs', '--file', 'templates/portals-kr.example.yml'], {
  cwd: ROOT,
  encoding: 'utf-8',
  timeout: 30_000,
});
if (validated.status === 0) pass('validate-portals accepts templates/portals-kr.example.yml');
else fail(`validate-portals.kr exit ${validated.status}: ${(validated.stderr || validated.stdout || '').slice(0, 400)}`);
