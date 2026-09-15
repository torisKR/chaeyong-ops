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

if (pkg.scripts?.['serve:dashboard'] && !pkg.scripts['serve:dashboard'].includes('--web')) {
  pass('serve:dashboard remains the TUI');
} else {
  fail('serve:dashboard should stay the Bubble Tea TUI (no --web)');
}

const docs = join(ROOT, 'docs', 'DASHBOARD-KR.md');
if (existsSync(docs) && readFileSync(docs, 'utf8').includes('127.0.0.1:3847')) {
  pass('docs/DASHBOARD-KR.md documents the loopback URL');
} else {
  fail('docs/DASHBOARD-KR.md missing or has no 127.0.0.1:3847');
}

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
if (readme.includes('npm run dashboard:web') && readme.includes('127.0.0.1:3847')) {
  pass('README 5분 시작 points at the localhost board');
} else {
  fail('README.md does not mention dashboard:web / 127.0.0.1:3847');
}

const main = readFileSync(join(ROOT, 'dashboard', 'main.go'), 'utf8');
if (main.includes('webFlag') && main.includes('webui.ListenAndServe')) {
  pass('dashboard/main.go --web serves the HTTP board');
} else {
  fail('dashboard/main.go does not wire --web to webui.ListenAndServe');
}

const fixture = join(ROOT, 'test-fixtures', 'dashboard-web', 'data', 'applications.md');
const fixtureText = existsSync(fixture) ? readFileSync(fixture, 'utf8') : '';
if (fixtureText.includes('예시테크') && fixtureText.includes('테스트 픽스처')) {
  pass('webui testdata is a fictional tracker fixture');
} else {
  fail('missing fictional applications.md fixture for the web board');
}
