/**
 * Optional hiring-ops notification layer.
 *
 * Secrets come from the environment (.env, never committed). Optional YAML at
 * config/integrations.yml (copy from config/integrations.example.yml) can
 * disable a channel even when its env vars are set, and sets score_threshold /
 * on_new_jobs. Absent YAML = env-only: a set webhook is enough to deliver.
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';
import { getCareerOpsRoot } from '../path-resolver.mjs';
import * as slack from './slack.mjs';
import * as discord from './discord.mjs';
import * as telegram from './telegram.mjs';
import * as notion from './notion.mjs';
import * as jira from './jira.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(ROOT, '..');

export const CHANNELS = [slack, discord, telegram, notion, jira];
export const LIVE_CHANNELS = CHANNELS.filter((c) => !c.stub);
export const STUB_CHANNELS = CHANNELS.filter((c) => c.stub);

const DEFAULTS = {
  enabled: true,
  score_threshold: 4.0,
  on_new_jobs: true,
  on_high_score: true,
};

/**
 * Load optional config/integrations.yml. Missing file is the common case.
 *
 * @param {string} [root]
 * @returns {object}
 */
export function loadIntegrationsConfig(root = getCareerOpsRoot()) {
  const path = join(root, 'config', 'integrations.yml');
  if (!existsSync(path)) return { ...DEFAULTS, channels: {} };
  try {
    const parsed = yaml.load(readFileSync(path, 'utf-8')) || {};
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULTS, channels: {} };
    return {
      ...DEFAULTS,
      ...parsed,
      channels: parsed.channels && typeof parsed.channels === 'object' ? parsed.channels : {},
    };
  } catch {
    return { ...DEFAULTS, channels: {}, parseError: true };
  }
}

/**
 * Channel enabled in YAML? Missing YAML / missing key → true (env is enough).
 *
 * @param {object} cfg
 * @param {string} id
 * @returns {boolean}
 */
export function channelEnabledInConfig(cfg, id) {
  if (cfg?.enabled === false) return false;
  const ch = cfg?.channels?.[id];
  if (ch && typeof ch === 'object' && ch.enabled === false) return false;
  return true;
}

/**
 * Status for doctor / `notify.mjs --status`. Never includes secret values.
 *
 * @param {{ env?: NodeJS.ProcessEnv, root?: string }} [opts]
 * @returns {{ id: string, configured: boolean, enabled: boolean, stub: boolean, missingEnv: string[] }[]}
 */
export function integrationStatus(opts = {}) {
  const env = opts.env || process.env;
  const cfg = loadIntegrationsConfig(opts.root || getCareerOpsRoot());
  return CHANNELS.map((ch) => {
    const missingEnv = (ch.envVars || []).filter((name) => !String(env[name] || '').trim());
    // Notion accepts either token name.
    const configured = typeof ch.isConfigured === 'function' ? ch.isConfigured(env) : missingEnv.length === 0;
    return {
      id: ch.id,
      configured,
      enabled: channelEnabledInConfig(cfg, ch.id),
      stub: Boolean(ch.stub),
      missingEnv: configured ? [] : (ch.id === 'notion'
        ? ['NOTION_TOKEN or NOTION_ACCESS_TOKEN']
        : missingEnv),
    };
  });
}

/**
 * Channels that should actually receive a live (or dry-run) delivery.
 * Stubs are excluded unless includeStubs is set (status / --test mentions them).
 *
 * @param {{ env?: NodeJS.ProcessEnv, root?: string, includeStubs?: boolean }} [opts]
 */
export function activeChannels(opts = {}) {
  const env = opts.env || process.env;
  const cfg = loadIntegrationsConfig(opts.root || getCareerOpsRoot());
  return CHANNELS.filter((ch) => {
    if (!opts.includeStubs && ch.stub) return false;
    if (!ch.isConfigured(env)) return false;
    return channelEnabledInConfig(cfg, ch.id);
  });
}

export function scoreThreshold(cfg) {
  const n = Number(cfg?.score_threshold);
  return Number.isFinite(n) ? n : DEFAULTS.score_threshold;
}

/**
 * Keep jobs at/above the threshold. Jobs with no numeric score pass when
 * `on_new_jobs` is true (scan itself does not score postings).
 *
 * @param {Array<{ score?: number|string }>} jobs
 * @param {object} cfg
 */
export function filterJobsForNotify(jobs, cfg) {
  const list = Array.isArray(jobs) ? jobs : [];
  const threshold = scoreThreshold(cfg);
  const allowUnscored = cfg?.on_new_jobs !== false;
  return list.filter((job) => {
    const n = Number(job?.score);
    if (!Number.isFinite(n)) return allowUnscored;
    return n >= threshold;
  });
}

export { slack, discord, telegram, notion, jira, REPO_ROOT };
