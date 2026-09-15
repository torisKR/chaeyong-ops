// tests/doctor-integrations.test.mjs — doctor --json lists channels, never secrets
import { pass, fail, ROOT, NODE } from './helpers.mjs';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

console.log('\ndoctor.mjs — integrations status');

const dir = mkdtempSync(join(tmpdir(), 'co-doctor-integ-'));
mkdirSync(join(dir, 'config'), { recursive: true });
mkdirSync(join(dir, 'modes'), { recursive: true });
writeFileSync(join(dir, 'cv.md'), '# Test\n');
writeFileSync(join(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: "김테스트"\nexperience:\n  years: 1.7\n');
writeFileSync(join(dir, 'modes', '_profile.md'), '# Profile\n백엔드\n');
writeFileSync(join(dir, 'portals.yml'), 'job_boards:\n  - name: Wanted — 백엔드\n    provider: wanted\n    enabled: true\n');

const env = {
  ...process.env,
  SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/LEAKME/PATH/TOKEN',
  DISCORD_WEBHOOK_URL: '',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  NOTION_TOKEN: 'ntn_leakme',
  NOTION_ACCESS_TOKEN: '',
  JIRA_BASE_URL: '',
  JIRA_EMAIL: '',
  JIRA_API_TOKEN: '',
};

let parsed;
try {
  const out = execFileSync(NODE, [join(ROOT, 'doctor.mjs'), '--json', '--target', dir], {
    cwd: ROOT, encoding: 'utf-8', env, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  parsed = JSON.parse(out);
} catch (e) {
  fail(`doctor --json crashed: ${e.message} ${e.stderr || ''}`);
}

if (parsed && parsed.integrations?.slack?.configured === true
    && parsed.integrations?.discord?.configured === false
    && parsed.integrations?.notion?.stub === true
    && parsed.integrations?.notion?.configured === true
    && parsed.integrations?.jira?.stub === true) {
  pass('doctor --json integrations: slack configured, discord off, notion/jira stubs');
} else {
  fail(`integrations JSON: ${JSON.stringify(parsed?.integrations)}`);
}

const dump = JSON.stringify(parsed);
if (parsed && !dump.includes('LEAKME') && !dump.includes('ntn_leakme') && !dump.includes('hooks.slack.com')) {
  pass('doctor --json does not print webhook URLs or tokens');
} else fail('doctor JSON leaked a secret substring');
