/**
 * blocked-companies.mjs — portals.yml company skip-list for scan.
 *
 * Complements data/blacklist.md (#1742). OSS users list companies they never
 * want scanned (former employers, etc.) in portals.yml:
 *
 *   blocked_companies:        # preferred
 *     - ExampleCorp
 *   exclude_companies:        # alias
 *     - "Example Agency"
 *
 * Matching uses the same normalizeCompany() key as the markdown blacklist, so
 * "ExampleCorp" and "Example Corp." are the same company. Empty / absent lists
 * are a no-op. Nothing here ever writes to portals.yml or data/blacklist.md.
 */

import { normalizeCompany } from './tracker-utils.mjs';

const PORTALS_KEYS = ['blocked_companies', 'exclude_companies'];

/**
 * Parse one portals.yml skip-list value into a blacklist-shaped Map.
 *
 * @param {unknown} list - YAML array of company name strings.
 * @param {string} source - Label stored on each entry (e.g. 'portals.yml blocked_companies').
 * @returns {Map<string, {company: string, since: string, scope: string, reason: string}>}
 */
export function parseBlockedCompanyList(list, source = 'portals.yml') {
  const entries = new Map();
  if (list == null) return entries;
  const arr = Array.isArray(list) ? list : [list];
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const company = item.trim();
    if (!company) continue;
    const key = normalizeCompany(company);
    if (!key || entries.has(key)) continue;
    entries.set(key, {
      company,
      since: '',
      scope: 'company',
      reason: source,
    });
  }
  return entries;
}

/**
 * Read blocked_companies and/or exclude_companies from a parsed portals.yml.
 * Both keys are unioned; first-seen key wins on duplicates (same as parseBlacklist).
 *
 * @param {object|null|undefined} config - Parsed portals.yml object.
 * @returns {Map<string, {company: string, since: string, scope: string, reason: string}>}
 */
export function parsePortalsBlockedCompanies(config) {
  const merged = new Map();
  if (!config || typeof config !== 'object') return merged;
  for (const key of PORTALS_KEYS) {
    const parsed = parseBlockedCompanyList(config[key], `portals.yml ${key}`);
    for (const [k, v] of parsed) {
      if (!merged.has(k)) merged.set(k, v);
    }
  }
  return merged;
}

/**
 * Union two blacklist Maps. `primary` wins on duplicate keys so a data/blacklist.md
 * reason is kept when the same company is also listed in portals.yml.
 *
 * @param {Map<string, object>} primary
 * @param {Map<string, object>} extra
 * @returns {Map<string, object>}
 */
export function mergeCompanyBlocklists(primary, extra) {
  const out = new Map(primary || []);
  for (const [k, v] of extra || []) {
    if (!out.has(k)) out.set(k, v);
  }
  return out;
}

/**
 * True when `name` matches a blocklist entry (same folding as the scan gate).
 *
 * @param {string} name
 * @param {Map<string, object>|null|undefined} blocklist
 * @returns {boolean}
 */
export function companyIsBlocked(name, blocklist) {
  if (!blocklist || blocklist.size === 0) return false;
  const key = normalizeCompany(name || '');
  return Boolean(key && blocklist.has(key));
}
