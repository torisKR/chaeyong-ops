/**
 * Telegram bot sendMessage notifier.
 * Secrets: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.
 * The token is part of the URL — never log it.
 */

import { postJson } from './_http.mjs';

export const id = 'telegram';
export const envVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];

export function isConfigured(env = process.env) {
  return Boolean(String(env.TELEGRAM_BOT_TOKEN || '').trim())
    && Boolean(String(env.TELEGRAM_CHAT_ID || '').trim());
}

/**
 * @param {{ text: string }} payload
 * @param {{ fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv, dryRun?: boolean }} [opts]
 */
export async function send(payload, opts = {}) {
  const env = opts.env || process.env;
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) {
    return { ok: false, channel: id, skipped: true, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' };
  }
  if (opts.dryRun) return { ok: true, channel: id, dryRun: true };
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const result = await postJson(url, {
    chat_id: chatId,
    text: payload.text,
    disable_web_page_preview: true,
  }, { fetchImpl: opts.fetchImpl });
  return { ...result, channel: id };
}
