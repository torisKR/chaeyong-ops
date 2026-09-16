// tests/getting-started-kr.test.mjs — OSS onboarding docs stay discoverable.
import { pass, fail, ROOT } from './helpers.mjs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('\nKorean getting-started docs');

const readme = readFileSync(join(ROOT, 'README.md'), 'utf-8');
const getting = join(ROOT, 'docs', 'GETTING-STARTED-KR.md');
const applyKr = readFileSync(join(ROOT, 'docs', 'APPLY-KR.md'), 'utf-8');
const profileEx = readFileSync(join(ROOT, 'config', 'profile.example.yml'), 'utf-8');
const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf-8');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));

if (/5분 시작/.test(readme) && /setup\.mjs --defaults/.test(readme) && /experience\.years/.test(readme)
    && /직종/.test(readme) && /blocked_companies/.test(readme) && /chaeyong-ops-consulting/.test(readme)
    && /GETTING-STARTED-KR\.md/.test(readme) && /APPLY-KR\.md/.test(readme)
    && /NOTICE\.md/.test(readme) && /assets\/icon\.png/.test(readme) && /assets\/banner\.png/.test(readme)) {
  pass('README.md has 5분 시작, setup, 직종/연차/블랙리스트, consulting skill, docs + badge assets');
} else {
  fail('README.md 5분 시작 section is incomplete');
}

if (existsSync(getting)) {
  const gs = readFileSync(getting, 'utf-8');
  const hasIgnore = /config\/profile\.yml/.test(gs) && /cv\.md/.test(gs) && /\.gitignore/.test(gs);
  const hasCursor = /Cursor/.test(gs) && /Claude Code/.test(gs);
  const hasTos = /이용약관/.test(gs) && /never submits an application/.test(gs);
  if (hasIgnore && hasCursor && hasTos && /experience\.years/.test(gs) && /본인 경력\(년\) 숫자/.test(gs)
      && /직종/.test(gs) && /--configure/.test(gs) && /blocked_companies/.test(gs)) {
    pass('docs/GETTING-STARTED-KR.md covers Cursor/Claude, gitignore, ToS, 직종/연차/블랙리스트');
  } else {
    fail('GETTING-STARTED-KR.md missing a required section');
  }
} else {
  fail('docs/GETTING-STARTED-KR.md is missing');
}

if (/setup\.mjs --defaults/.test(applyKr) && /GETTING-STARTED-KR/.test(applyKr) && /blocked_companies/.test(applyKr)) {
  pass('docs/APPLY-KR.md links setup.mjs and GETTING-STARTED-KR and documents blocked_companies');
} else {
  fail('APPLY-KR.md does not point at setup / getting-started / blocked_companies');
}

if (/본인 경력\(년\) 숫자/.test(profileEx) && /years:\s*1\.7/.test(profileEx)
    && /output:\s*ko/.test(profileEx) && /modes_dir:\s*modes\/ko/.test(profileEx)
    && /서울/.test(profileEx) && /you\.example@example\.com/.test(profileEx)
    && !/@gmail\.com/.test(profileEx) && !/@naver\.com/.test(profileEx)) {
  pass('profile.example.yml has Korean years comment, KR defaults, no real email domain');
} else {
  fail('profile.example.yml polish incomplete');
}

const ignored = ['cv.md', 'config/profile.yml', 'portals.yml'].every((p) => {
  if (p === 'cv.md') return /^cv\.md$/m.test(gitignore);
  if (p === 'config/profile.yml') return /config\/profile\.yml/.test(gitignore);
  return /^portals\.yml$/m.test(gitignore);
});
if (ignored && /data\/\*/.test(gitignore)) pass('.gitignore still covers profile, cv, portals, data/*');
else fail('.gitignore no longer covers user-layer PII paths');

if (pkg.scripts?.setup === 'node setup.mjs --defaults' && pkg.scripts?.['scan:kr'] === 'node scan.mjs' && pkg.scripts?.doctor && pkg.scripts?.notify === 'node notify.mjs') {
  pass('package.json scripts: setup, scan:kr, doctor, notify');
} else {
  fail(`package.json scripts missing: ${JSON.stringify({ setup: pkg.scripts?.setup, scanKr: pkg.scripts?.['scan:kr'], doctor: pkg.scripts?.doctor, notify: pkg.scripts?.notify })}`);
}
