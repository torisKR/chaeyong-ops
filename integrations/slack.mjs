/**
 * Slack incoming webhook notifier.
 * Secret: SLACK_WEBHOOK_URL (https://hooks.slack.com/services/...).
 */

import { postJson } from './_http.mjs';

export const id = 'slack';
export const envVars = ['SLACK_WEBHOOK_URL'];

export function isConfigured(env = process.env) {
  return Boolean(String(env.SLACK_WEBHOOK_URL || '').trim());
}

/**
 * @param {{ text: string }} payload
 * @param {{ fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv, dryRun?: boolean }} [opts]
 */
export async function send(payload, opts = {}) {
  const env = opts.env || process.env;
  const url = String(env.SLACK_WEBHOOK_URL || '').trim();
  if (!url) return { ok: false, channel: id, skipped: true, error: 'SLACK_WEBHOOK_URL not set' };
  if (opts.dryRun) return { ok: true, channel: id, dryRun: true };
  const result = await postJson(url, { text: payload.text }, { fetchImpl: opts.fetchImpl });
  return { ...result, channel: id };
}
