// tests/portals-kr-example.test.mjs — Korean scanner template stays operational.
import { pass, fail, ROOT } from './helpers.mjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import * as yaml from 'js-yaml';

console.log('\nportals-kr.example.yml — Korean backend/fullstack boards');

const path = join(ROOT, 'templates', 'portals-kr.example.yml');
const raw = readFileSync(path, 'utf-8');
const doc = yaml.load(raw);
const boards = Array.isArray(doc?.job_boards) ? doc.job_boards : [];

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

const validated = spawnSync(process.execPath, ['validate-portals.mjs', '--file', 'templates/portals-kr.example.yml'], {
  cwd: ROOT,
  encoding: 'utf-8',
  timeout: 30_000,
});
if (validated.status === 0) pass('validate-portals accepts templates/portals-kr.example.yml');
else fail(`validate-portals.kr exit ${validated.status}: ${(validated.stderr || validated.stdout || '').slice(0, 400)}`);
