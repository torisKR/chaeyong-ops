// tests/dashboard-web.test.mjs — localhost Korean status board wiring.
import { pass, fail, ROOT } from './helpers.mjs';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('\nlocalhost dashboard:web');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
if (pkg.scripts?.['dashboard:web']?.includes('--web')) {
  pass('package.json dashboard:web launches Go --web');
} else {
  fail(`package.json dashboard:web missing --web: ${pkg.scripts?.['dashboard:web']}`);
}

if (pkg.scripts?.dashboard === 'npm run dashboard:web') {
  pass('npm run dashboard aliases dashboard:web');
} else {
  fail(`package.json dashboard alias = ${pkg.scripts?.dashboard}`);
}

if (pkg.scripts?.['serve:dashboard']?.includes('--path ..') && !pkg.scripts['serve:dashboard'].includes('--web')) {
  pass('serve:dashboard is the TUI with --path ..');
} else {
  fail(`serve:dashboard should stay the Bubble Tea TUI with --path ..: ${pkg.scripts?.['serve:dashboard']}`);
}

const docs = join(ROOT, 'docs', 'DASHBOARD-KR.md');
if (existsSync(docs) && readFileSync(docs, 'utf8').includes('127.0.0.1:3847')) {
  pass('docs/DASHBOARD-KR.md documents the loopback URL');
} else {
  fail('docs/DASHBOARD-KR.md missing or has no 127.0.0.1:3847');
}

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
if (readme.includes('npm run dashboard:web') && readme.includes('127.0.0.1:3847')
    && readme.includes('npm run serve:dashboard') && readme.includes('Go 1.24+')) {
  pass('README documents both viewers and Go 1.24+');
} else {
  fail('README.md should mention dashboard:web, serve:dashboard, 127.0.0.1:3847, and Go 1.24+');
}

const main = readFileSync(join(ROOT, 'dashboard', 'main.go'), 'utf8');
if (main.includes('webFlag') && main.includes('webui.ListenAndServe')) {
  pass('dashboard/main.go --web serves the HTTP board');
} else {
  fail('dashboard/main.go does not wire --web to webui.ListenAndServe');
}

const settingsHtml = join(ROOT, 'dashboard', 'internal', 'webui', 'settings.html');
const settingsGo = readFileSync(join(ROOT, 'dashboard', 'internal', 'webui', 'server.go'), 'utf8');
if (existsSync(settingsHtml) && /blocked_companies/.test(readFileSync(settingsHtml, 'utf8'))
    && settingsGo.includes('/settings') && /experience\.years/.test(readFileSync(docs, 'utf8'))
    && /\/settings/.test(readFileSync(docs, 'utf8'))) {
  pass('dashboard /settings documents 직종/연차/블랙리스트');
} else {
  fail('dashboard settings page or DASHBOARD-KR /settings docs missing');
}

if (main.includes('SetLang("ko")') && main.includes('Defaults to ko')) {
  pass('TUI defaults to Korean labels (not LANG=en_US)');
} else {
  fail('dashboard/main.go should default --lang / SetLang to ko');
}

const example = join(ROOT, 'examples', 'applications.example.md');
const exampleText = existsSync(example) ? readFileSync(example, 'utf8') : '';
const statuses = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Hired', 'Rejected', 'Discarded', 'SKIP'];
const missingStatus = statuses.filter((s) => !exampleText.includes(`| ${s} |`));
if (exampleText.includes('허구') && exampleText.includes('예시테크') && missingStatus.length === 0
    && !/@gmail\.|@naver\.|010-/.test(exampleText)) {
  pass('examples/applications.example.md documents all canonical statuses (fictional, no PII)');
} else {
  fail(`applications.example.md incomplete or looks like PII: missing=${missingStatus.join(',')}`);
}

const fixture = join(ROOT, 'test-fixtures', 'dashboard-web', 'data', 'applications.md');
const fixtureText = existsSync(fixture) ? readFileSync(fixture, 'utf8') : '';
if (fixtureText.includes('예시테크') && fixtureText.includes('테스트 픽스처')) {
  pass('webui testdata is a fictional tracker fixture');
} else {
  fail('missing fictional applications.md fixture for the web board');
}
