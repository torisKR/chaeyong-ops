/**
 * Notion notifier — stub.
 *
 * Full tracker mirroring already lives in plugins/notion (NOTION_ACCESS_TOKEN +
 * NOTION_PARENT_PAGE_ID). For hiring-ops *alerts*, prefer Cursor's Notion MCP
 * (create a page) — see docs/INTEGRATIONS.md and docs/NOTION_SETUP.md.
 *
 * This channel never POSTs. doctor reports it as configured when a token is
 * present so users can see they have a Notion path ready.
 */

export const id = 'notion';
export const envVars = ['NOTION_TOKEN', 'NOTION_ACCESS_TOKEN'];
export const stub = true;

export function isConfigured(env = process.env) {
  return Boolean(String(env.NOTION_TOKEN || env.NOTION_ACCESS_TOKEN || '').trim());
}

/**
 * @param {{ text: string, event?: string }} _payload
 * @param {{ dryRun?: boolean, env?: NodeJS.ProcessEnv }} [opts]
 */
export async function send(_payload, opts = {}) {
  const env = opts.env || process.env;
  if (!isConfigured(env)) {
    return { ok: false, channel: id, skipped: true, stub: true, error: 'NOTION_TOKEN / NOTION_ACCESS_TOKEN not set' };
  }
  return {
    ok: true,
    channel: id,
    skipped: true,
    stub: true,
    dryRun: Boolean(opts.dryRun),
    error: 'Notion alerts are a stub — use Cursor Notion MCP or `node plugins.mjs run notion export` (see docs/INTEGRATIONS.md)',
  };
}
