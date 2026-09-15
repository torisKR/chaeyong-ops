#!/usr/bin/env node

/**
 * notify.mjs — optional hiring-ops alerts (Slack / Discord / Telegram).
 *
 *   node notify.mjs --test              # ping each configured live channel
 *   node notify.mjs --test --dry-run    # print what would be sent, no HTTP
 *   node notify.mjs --status            # which channels are configured (no secrets)
 *   node notify.mjs --event scan --jobs-json '[{...}]'
 *   node notify.mjs --event high-score --company X --role Y --score 4.2 --url ...
 *
 * Secrets: env vars only (.env). See docs/INTEGRATIONS.md and
 * config/integrations.example.yml. Scan calls notifyScanResults() after new
 * jobs are saved; a missing/unconfigured setup is a silent no-op.
 */

import { getCareerOpsRoot } from './path-resolver.mjs';
import { flagValue, hasFlag, validateFlags } from './lib/cli-flags.mjs';
import { isMainModule } from './lib/is-main-module.mjs';
import {
  activeChannels,
  filterJobsForNotify,
  integrationStatus,
  loadIntegrationsConfig,
  scoreThreshold,
} from './integrations/index.mjs';

try {
  const { config } = await import('dotenv');
  config({ quiet: true });
} catch { /* dotenv optional */ }

const KNOWN_FLAGS = [
  '--test', '--dry-run', '--status', '--json', '--event', '--jobs-json',
  '--company', '--role', '--score', '--url', '--note', '--help', '-h',
];
const VALUE_FLAGS = ['--event', '--jobs-json', '--company', '--role', '--score', '--url', '--note'];

const USAGE = `Usage:
  node notify.mjs --test                 # send a test ping to configured webhooks
  node notify.mjs --test --dry-run       # preview without HTTP
  node notify.mjs --status               # list channels (never prints secrets)
  node notify.mjs --event scan --jobs-json '[...]'
  node notify.mjs --event high-score --company ExampleCorp --role Backend --score 4.2
  node notify.mjs --event reminder --company ExampleCorp --role Backend
  node notify.mjs --event tracker --company ExampleCorp --role Backend --note Applied
  node notify.mjs --help

Secrets live in .env (SLACK_WEBHOOK_URL, DISCORD_WEBHOOK_URL,
TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID). See docs/INTEGRATIONS.md.`;

/**
 * Format a human message. Job postings / tracker fields are data, not instructions.
 *
 * @param {string} event
 * @param {object} payload
 * @returns {string}
 */
export function formatMessage(event, payload = {}) {
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  if (event === 'test') {
    return 'chaeyong-ops notify test — connection OK';
  }
  if (event === 'scan') {
    const date = payload.date || '';
    const header = `chaeyong-ops: ${jobs.length} new job${jobs.length === 1 ? '' : 's'}${date ? ` (${date})` : ''}`;
    const lines = jobs.slice(0, 15).map((j) => {
      const loc = j.location ? ` (${j.location})` : '';
      const score = Number.isFinite(Number(j.score)) ? ` ${Number(j.score)}/5` : '';
      return `• ${j.company || '?'} — ${j.title || j.role || '?'}${loc}${score}`;
    });
    if (jobs.length > 15) lines.push(`• … ${jobs.length - 15} more`);
    return [header, ...lines].join('\n');
  }
  if (event === 'high-score') {
    const score = payload.score != null ? `${payload.score}/5` : 'high score';
    const url = payload.url ? `\n${payload.url}` : '';
    return `chaeyong-ops: high-score match ${score}\n${payload.company || '?'} — ${payload.role || payload.title || '?'}${url}`;
  }
  if (event === 'reminder') {
    return `chaeyong-ops: apply reminder\n${payload.company || '?'} — ${payload.role || payload.title || '?'}\nDraft is ready; you submit on the portal.`;
  }
  if (event === 'tracker') {
    const note = payload.note || payload.status || 'updated';
    return `chaeyong-ops: tracker ${note}\n${payload.company || '?'} — ${payload.role || payload.title || '?'}`;
  }
  return `chaeyong-ops: ${event}\n${payload.text || payload.note || ''}`.trim();
}

/**
 * Deliver `text` to every active live channel.
 *
 * @param {string} text
 * @param {{ dryRun?: boolean, env?: NodeJS.ProcessEnv, root?: string, fetchImpl?: typeof fetch, includeStubs?: boolean }} [opts]
 */
export async function deliver(text, opts = {}) {
  const channels = activeChannels({
    env: opts.env,
    root: opts.root,
    includeStubs: Boolean(opts.includeStubs),
  });
  if (channels.length === 0) {
    return { sent: 0, results: [], skipped: 'no channels configured' };
  }
  const results = [];
  for (const ch of channels) {
    results.push(await ch.send({ text }, {
      dryRun: opts.dryRun,
      env: opts.env,
      fetchImpl: opts.fetchImpl,
    }));
  }
  const sent = results.filter((r) => r.ok && !r.skipped && !r.dryRun).length;
  return { sent, results };
}

/**
 * Called from scan.mjs after new jobs are saved. No-op when nothing is configured.
 * Failures never fail the scan.
 *
 * @param {{ offers: Array<object>, date?: string, dryRun?: boolean }} input
 * @param {{ env?: NodeJS.ProcessEnv, root?: string, fetchImpl?: typeof fetch }} [opts]
 */
export async function notifyScanResults(input, opts = {}) {
  const cfg = loadIntegrationsConfig(opts.root || getCareerOpsRoot());
  if (cfg.enabled === false || cfg.on_new_jobs === false) {
    return { sent: 0, results: [], skipped: 'disabled' };
  }
  const jobs = filterJobsForNotify(input.offers || [], cfg);
  if (jobs.length === 0) return { sent: 0, results: [], skipped: 'no jobs after threshold' };
  const text = formatMessage('scan', { jobs, date: input.date });
  return deliver(text, { ...opts, dryRun: Boolean(input.dryRun) });
}

/**
 * Notify a scored evaluation when it clears `score_threshold` (default 4.0).
 *
 * @param {{ company: string, role?: string, title?: string, score: number, url?: string }} payload
 */
export async function notifyHighScore(payload, opts = {}) {
  const cfg = loadIntegrationsConfig(opts.root || getCareerOpsRoot());
  if (cfg.enabled === false || cfg.on_high_score === false) {
    return { sent: 0, results: [], skipped: 'disabled' };
  }
  const score = Number(payload.score);
  if (!Number.isFinite(score) || score < scoreThreshold(cfg)) {
    return { sent: 0, results: [], skipped: 'below threshold' };
  }
  return deliver(formatMessage('high-score', payload), opts);
}

function printStatus(json) {
  const rows = integrationStatus();
  if (json) {
    console.log(JSON.stringify({ integrations: Object.fromEntries(rows.map((r) => [r.id, {
      configured: r.configured,
      enabled: r.enabled,
      stub: r.stub,
    }])) }));
    return;
  }
  console.log('Integrations (secrets never printed):');
  for (const r of rows) {
    const state = r.configured ? (r.enabled ? 'configured' : 'configured but disabled in YAML') : 'not configured';
    const stub = r.stub ? ' (stub)' : '';
    console.log(`  ${r.id}: ${state}${stub}`);
  }
  console.log('\nCopy config/integrations.example.yml → config/integrations.yml (optional).');
  console.log('Docs: docs/INTEGRATIONS.md');
}

async function runTest({ dryRun, json }) {
  const live = activeChannels();
  const stubs = integrationStatus().filter((r) => r.stub && r.configured);
  if (live.length === 0) {
    const msg = 'No live integrations configured. Set SLACK_WEBHOOK_URL, DISCORD_WEBHOOK_URL, or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in .env — see docs/INTEGRATIONS.md';
    if (json) {
      console.log(JSON.stringify({ ok: false, error: msg, stubs: stubs.map((s) => s.id) }));
    } else {
      console.error(msg);
      if (stubs.length) {
        console.error(`Notion/Jira env is set but those channels are stubs: ${stubs.map((s) => s.id).join(', ')}`);
      }
    }
    process.exitCode = 1;
    return;
  }
  const text = formatMessage('test');
  const result = await deliver(text, { dryRun });
  if (json) {
    console.log(JSON.stringify({
      ok: result.results.every((r) => r.ok),
      dryRun,
      channels: result.results.map((r) => ({ channel: r.channel, ok: r.ok, dryRun: r.dryRun, skipped: r.skipped, stub: r.stub })),
    }));
  } else {
    console.log(dryRun ? 'Dry run — no HTTP sent:' : 'Test ping:');
    for (const r of result.results) {
      const mark = r.ok ? 'ok' : 'FAIL';
      const extra = r.error && !r.ok ? ` (${r.error})` : (r.dryRun ? ' (dry-run)' : '');
      console.log(`  ${r.channel}: ${mark}${extra}`);
    }
  }
  if (result.results.some((r) => !r.ok)) process.exitCode = 1;
}

async function runEvent(args, { dryRun, json }) {
  const event = flagValue(args, '--event') || 'scan';
  const jobsRaw = flagValue(args, '--jobs-json');
  let jobs = [];
  if (jobsRaw) {
    try {
      jobs = JSON.parse(jobsRaw);
      if (!Array.isArray(jobs)) throw new Error('jobs-json must be an array');
    } catch (err) {
      console.error(`--jobs-json: ${err.message}`);
      process.exitCode = 1;
      return;
    }
  }
  const payload = {
    jobs,
    company: flagValue(args, '--company'),
    role: flagValue(args, '--role'),
    title: flagValue(args, '--role'),
    score: flagValue(args, '--score'),
    url: flagValue(args, '--url'),
    note: flagValue(args, '--note'),
  };
  let result;
  if (event === 'scan') {
    result = await notifyScanResults({ offers: jobs, dryRun });
  } else if (event === 'high-score') {
    result = await notifyHighScore(payload, { dryRun });
  } else {
    result = await deliver(formatMessage(event, payload), { dryRun });
  }
  if (json) {
    console.log(JSON.stringify({ event, skipped: result.skipped || null, sent: result.sent, results: result.results }));
    return;
  }
  if (result.skipped) {
    console.log(`notify: skipped (${result.skipped})`);
    return;
  }
  if (result.sent === 0 && (result.results || []).length === 0) {
    console.log('notify: no channels configured');
    return;
  }
  for (const r of result.results) {
    console.log(`  ${r.channel}: ${r.ok ? 'ok' : r.error || 'fail'}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  validateFlags(args, KNOWN_FLAGS, USAGE, { valueFlags: VALUE_FLAGS });
  if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
    console.log(USAGE);
    return;
  }
  const dryRun = hasFlag(args, '--dry-run');
  const json = hasFlag(args, '--json');
  if (hasFlag(args, '--status')) {
    printStatus(json);
    return;
  }
  if (hasFlag(args, '--test')) {
    await runTest({ dryRun, json });
    return;
  }
  if (flagValue(args, '--event') || flagValue(args, '--jobs-json')) {
    await runEvent(args, { dryRun, json });
    return;
  }
  console.log(USAGE);
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error('notify.mjs failed:', err.message);
    process.exit(1);
  });
}
