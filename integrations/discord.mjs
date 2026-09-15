/**
 * Discord incoming webhook notifier.
 * Secret: DISCORD_WEBHOOK_URL (https://discord.com/api/webhooks/...).
 */

import { postJson } from './_http.mjs';

export const id = 'discord';
export const envVars = ['DISCORD_WEBHOOK_URL'];

export function isConfigured(env = process.env) {
  return Boolean(String(env.DISCORD_WEBHOOK_URL || '').trim());
}

/**
 * Discord `content` is capped at 2000 characters.
 *
 * @param {{ text: string }} payload
 * @param {{ fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv, dryRun?: boolean }} [opts]
 */
export async function send(payload, opts = {}) {
  const env = opts.env || process.env;
  const url = String(env.DISCORD_WEBHOOK_URL || '').trim();
  if (!url) return { ok: false, channel: id, skipped: true, error: 'DISCORD_WEBHOOK_URL not set' };
  if (opts.dryRun) return { ok: true, channel: id, dryRun: true };
  const content = String(payload.text || '').slice(0, 2000);
  const result = await postJson(url, { content }, { fetchImpl: opts.fetchImpl });
  return { ...result, channel: id };
}
