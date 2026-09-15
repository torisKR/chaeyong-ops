// tests/notify.test.mjs — webhook notifiers, no secrets in status, score filter
import { pass, fail, ROOT, NODE } from './helpers.mjs';
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { formatMessage, deliver, notifyHighScore, notifyScanResults } from '../notify.mjs';
import {
  integrationStatus,
  filterJobsForNotify,
  loadIntegrationsConfig,
} from '../integrations/index.mjs';
import { isConfigured as slackConfigured } from '../integrations/slack.mjs';
import { send as sendSlack } from '../integrations/slack.mjs';
import { send as sendDiscord } from '../integrations/discord.mjs';
import { send as sendTelegram } from '../integrations/telegram.mjs';
import { send as sendNotion } from '../integrations/notion.mjs';
import { send as sendJira } from '../integrations/jira.mjs';

console.log('\nnotify / integrations');

const cleanEnv = {
  SLACK_WEBHOOK_URL: '',
  DISCORD_WEBHOOK_URL: '',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  NOTION_TOKEN: '',
  NOTION_ACCESS_TOKEN: '',
  JIRA_BASE_URL: '',
  JIRA_EMAIL: '',
  JIRA_API_TOKEN: '',
};

if (!slackConfigured(cleanEnv) && integrationStatus({ env: cleanEnv, root: ROOT }).every((r) => !r.configured)) {
  pass('empty env → no channel configured');
} else fail('empty env still showed a configured channel');

const secretEnv = {
  ...cleanEnv,
  SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/SECRET/PATH/TOKEN',
  DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/SECRET',
  TELEGRAM_BOT_TOKEN: '123:SECRET',
  TELEGRAM_CHAT_ID: '99',
  NOTION_TOKEN: 'ntn_secret',
  JIRA_BASE_URL: 'https://example.atlassian.net',
  JIRA_EMAIL: 'you.example@example.com',
  JIRA_API_TOKEN: 'jira-secret',
};

const status = integrationStatus({ env: secretEnv, root: ROOT });
const blob = JSON.stringify(status);
if (status.find((r) => r.id === 'slack')?.configured
    && status.find((r) => r.id === 'discord')?.configured
    && status.find((r) => r.id === 'telegram')?.configured
    && status.find((r) => r.id === 'notion')?.configured
    && status.find((r) => r.id === 'jira')?.configured
    && status.find((r) => r.id === 'notion')?.stub
    && status.find((r) => r.id === 'jira')?.stub
    && !blob.includes('SECRET')
    && !blob.includes('ntn_')
    && !blob.includes('jira-secret')
    && !blob.includes('hooks.slack.com')) {
  pass('status reports configured flags without secret values');
} else fail(`status leaked or missed a channel: ${blob}`);

const jobs = [
  { company: 'GoodCo', title: 'Backend', score: 4.2 },
  { company: 'LowCo', title: 'Intern', score: 3.1 },
  { company: 'NewCo', title: '풀스택' },
];
const kept = filterJobsForNotify(jobs, { score_threshold: 4.0, on_new_jobs: true });
if (kept.length === 2 && kept.some((j) => j.company === 'GoodCo') && kept.some((j) => j.company === 'NewCo')
    && !kept.some((j) => j.company === 'LowCo')) {
  pass('threshold keeps ≥4.0 and unscored scan jobs; drops 3.1');
} else fail(`filterJobsForNotify = ${JSON.stringify(kept)}`);

const scanOnly = filterJobsForNotify(jobs, { score_threshold: 4.0, on_new_jobs: false });
if (scanOnly.length === 1 && scanOnly[0].company === 'GoodCo') {
  pass('on_new_jobs: false drops unscored jobs');
} else fail(`on_new_jobs false = ${JSON.stringify(scanOnly)}`);

const msg = formatMessage('scan', { jobs: kept, date: '2026-09-15' });
if (/chaeyong-ops/.test(msg) && /GoodCo/.test(msg) && /NewCo/.test(msg) && !/LowCo/.test(msg)) {
  pass('scan digest names kept companies only');
} else fail(`formatMessage scan: ${msg}`);

if (/connection OK/.test(formatMessage('test'))) pass('test ping text is stable');
else fail('test message drifted');

const calls = [];
const fakeFetch = async (url, init) => {
  calls.push({ url, body: JSON.parse(init.body) });
  return { ok: true, status: 204 };
};

const slack = await sendSlack({ text: 'hello' }, {
  env: secretEnv,
  fetchImpl: fakeFetch,
});
const discord = await sendDiscord({ text: 'hello' }, {
  env: secretEnv,
  fetchImpl: fakeFetch,
});
const telegram = await sendTelegram({ text: 'hello' }, {
  env: secretEnv,
  fetchImpl: fakeFetch,
});
if (slack.ok && discord.ok && telegram.ok && calls.length === 3
    && calls[0].body.text === 'hello'
    && calls[1].body.content === 'hello'
    && calls[2].body.chat_id === '99'
    && calls[2].url.includes('api.telegram.org')) {
  pass('Slack/Discord/Telegram POST JSON via injected fetch');
} else fail(`live send: slack=${JSON.stringify(slack)} calls=${calls.length}`);

const httpRefused = await sendSlack({ text: 'x' }, {
  env: { SLACK_WEBHOOK_URL: 'http://evil.example/hook' },
  fetchImpl: fakeFetch,
});
if (!httpRefused.ok && /https/.test(httpRefused.error || '')) {
  pass('refuses non-https webhook URLs');
} else fail(`http webhook: ${JSON.stringify(httpRefused)}`);

const notion = await sendNotion({ text: 'x' }, { env: secretEnv });
const jira = await sendJira({ text: 'x' }, { env: secretEnv });
if (notion.stub && notion.skipped && jira.stub && jira.skipped) {
  pass('Notion and Jira stay stubs (no POST)');
} else fail(`stubs: ${JSON.stringify({ notion, jira })}`);

const tmp = mkdtempSync(join(tmpdir(), 'co-notify-cfg-'));
mkdirSync(join(tmp, 'config'), { recursive: true });
writeFileSync(join(tmp, 'config', 'integrations.yml'), 'enabled: true\non_new_jobs: false\nscore_threshold: 4.5\nchannels:\n  slack:\n    enabled: false\n', 'utf-8');
const cfg = loadIntegrationsConfig(tmp);
if (cfg.on_new_jobs === false && cfg.score_threshold === 4.5 && cfg.channels.slack.enabled === false) {
  pass('loadIntegrationsConfig reads gitignored-shape YAML from a data root');
} else fail(`cfg = ${JSON.stringify(cfg)}`);

const delivered = await deliver('ping', {
  env: secretEnv,
  root: tmp,
  fetchImpl: fakeFetch,
});
if (delivered.sent === 2 && delivered.results.every((r) => r.channel !== 'slack')) {
  pass('YAML can disable Slack while Discord/Telegram still fire');
} else fail(`deliver with slack disabled: ${JSON.stringify(delivered)}`);

const dry = await deliver('ping', { env: secretEnv, dryRun: true, fetchImpl: fakeFetch });
if (dry.results.some((r) => r.dryRun) && dry.results.filter((r) => r.channel === 'slack' || r.channel === 'discord' || r.channel === 'telegram').every((r) => r.ok)) {
  pass('dry-run marks live channels without requiring extra HTTP for Slack (may already be disabled)');
} else fail(`dry-run: ${JSON.stringify(dry)}`);

const scanSkip = await notifyScanResults(
  { offers: [{ company: 'NewCo', title: 'BE' }] },
  { env: cleanEnv, root: ROOT },
);
if (scanSkip.skipped === 'no channels configured' || scanSkip.sent === 0) {
  pass('scan notify is a no-op without credentials');
} else fail(`scan no-op: ${JSON.stringify(scanSkip)}`);

const high = await notifyHighScore(
  { company: 'ExampleCorp', role: 'Backend', score: 3.2 },
  { env: secretEnv, root: ROOT, dryRun: true },
);
if (high.skipped === 'below threshold') pass('high-score below 4.0 does not notify');
else fail(`high-score 3.2: ${JSON.stringify(high)}`);

const help = spawnSync(NODE, [join(ROOT, 'notify.mjs'), '--help'], {
  cwd: ROOT, encoding: 'utf-8', timeout: 15_000, env: { ...process.env, ...cleanEnv },
});
if (help.status === 0 && /Usage:/.test(help.stdout) && /INTEGRATIONS/.test(help.stdout)) {
  pass('notify.mjs --help prints usage');
} else fail(`notify --help: status=${help.status} ${help.stdout}${help.stderr}`);

const statusCli = spawnSync(NODE, [join(ROOT, 'notify.mjs'), '--status', '--json'], {
  cwd: ROOT, encoding: 'utf-8', timeout: 15_000,
  env: { ...process.env, ...secretEnv },
});
const statusOut = (statusCli.stdout || '').trim();
if (statusCli.status === 0 && /"slack"/.test(statusOut) && !statusOut.includes('SECRET') && !statusOut.includes('hooks.slack.com')) {
  pass('notify --status --json has no secret values');
} else fail(`notify --status: ${statusCli.status} ${statusOut.slice(0, 400)}`);

const dryCli = spawnSync(NODE, [join(ROOT, 'notify.mjs'), '--test', '--dry-run', '--json'], {
  cwd: ROOT, encoding: 'utf-8', timeout: 15_000,
  env: { ...process.env, ...secretEnv },
});
let dryJson;
try { dryJson = JSON.parse((dryCli.stdout || '').trim()); } catch { dryJson = null; }
if (dryCli.status === 0 && dryJson?.ok && dryJson?.dryRun && Array.isArray(dryJson.channels)) {
  pass('notify --test --dry-run --json succeeds without HTTP');
} else fail(`notify --test dry-run: ${dryCli.status} ${dryCli.stdout}${dryCli.stderr}`);
