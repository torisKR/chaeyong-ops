/**
 * Jira notifier — stub.
 *
 * Creating an issue needs JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN plus a
 * project key. That is more config than a webhook, so this channel reports
 * "configured" when the env trio is present and documents the REST call
 * instead of posting. See docs/INTEGRATIONS.md.
 */

export const id = 'jira';
export const envVars = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];
export const stub = true;

export function isConfigured(env = process.env) {
  return Boolean(String(env.JIRA_BASE_URL || '').trim())
    && Boolean(String(env.JIRA_EMAIL || '').trim())
    && Boolean(String(env.JIRA_API_TOKEN || '').trim());
}

/**
 * @param {{ text: string, event?: string }} _payload
 * @param {{ dryRun?: boolean, env?: NodeJS.ProcessEnv }} [opts]
 */
export async function send(_payload, opts = {}) {
  const env = opts.env || process.env;
  if (!isConfigured(env)) {
    return { ok: false, channel: id, skipped: true, stub: true, error: 'JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN not set' };
  }
  return {
    ok: true,
    channel: id,
    skipped: true,
    stub: true,
    dryRun: Boolean(opts.dryRun),
    error: 'Jira alerts are a stub — POST /rest/api/3/issue with the env trio (see docs/INTEGRATIONS.md)',
  };
}
