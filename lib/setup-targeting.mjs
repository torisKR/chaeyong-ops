/**
 * setup-targeting.mjs — 직종 / 연차 / 블랙리스트 writers for Korean onboarding.
 *
 * Pure helpers used by `setup.mjs` (TTY + flags) and tests. Comments in
 * profile.yml / portals.yml must survive, so patches are regex-based rather
 * than yaml.dump().
 *
 * No real company names, emails, or phone numbers live here.
 */

/** @typedef {{ id: string, label: string, roles: string[], titleKeywords: string[], boardKeywords: string[], searchKeywords: string[] }} JobFamily */

/** Preset job families OSS users can pick during setup. */
export const JOB_FAMILIES = Object.freeze([
  Object.freeze({
    id: 'backend',
    label: '백엔드',
    roles: Object.freeze(['백엔드 개발자']),
    titleKeywords: Object.freeze(['백엔드', 'backend', 'NestJS', 'Nest.js', 'Node.js', 'NodeJS', 'TypeScript']),
    boardKeywords: Object.freeze(['백엔드', 'NestJS', 'Node.js', 'TypeScript']),
    searchKeywords: Object.freeze(['백엔드']),
  }),
  Object.freeze({
    id: 'fullstack',
    label: '풀스택',
    roles: Object.freeze(['풀스택 개발자']),
    titleKeywords: Object.freeze(['풀스택', 'fullstack', 'full-stack', 'full stack', '백엔드', 'frontend', 'React', 'Next.js']),
    boardKeywords: Object.freeze(['풀스택', '백엔드', 'NestJS', 'Node.js', 'TypeScript']),
    searchKeywords: Object.freeze(['풀스택']),
  }),
  Object.freeze({
    id: 'frontend',
    label: '프론트엔드',
    roles: Object.freeze(['프론트엔드 개발자']),
    titleKeywords: Object.freeze(['프론트엔드', 'frontend', 'React', 'Next.js', 'NextJS']),
    boardKeywords: Object.freeze(['프론트엔드']),
    searchKeywords: Object.freeze(['프론트엔드']),
  }),
  Object.freeze({
    id: 'mobile',
    label: '모바일',
    roles: Object.freeze(['모바일 개발자']),
    titleKeywords: Object.freeze(['모바일', 'mobile', 'Android', 'iOS', 'React Native', 'Flutter']),
    boardKeywords: Object.freeze(['모바일']),
    searchKeywords: Object.freeze(['모바일']),
  }),
  Object.freeze({
    id: 'data',
    label: '데이터',
    roles: Object.freeze(['데이터 엔지니어']),
    titleKeywords: Object.freeze(['데이터', '데이터 엔지니어', 'data engineer', 'ML', '머신러닝']),
    boardKeywords: Object.freeze(['데이터 엔지니어']),
    searchKeywords: Object.freeze(['데이터 엔지니어']),
  }),
  Object.freeze({
    id: 'devops',
    label: 'DevOps',
    roles: Object.freeze(['DevOps 엔지니어']),
    titleKeywords: Object.freeze(['DevOps', 'SRE', '인프라', '플랫폼 엔지니어']),
    boardKeywords: Object.freeze(['DevOps']),
    searchKeywords: Object.freeze(['DevOps']),
  }),
  Object.freeze({
    id: 'other',
    label: '기타 (직접 입력)',
    roles: Object.freeze([]),
    titleKeywords: Object.freeze([]),
    boardKeywords: Object.freeze([]),
    searchKeywords: Object.freeze([]),
  }),
]);

/** Numbered experience bands. CLI `--years 1` is numeric years, not band 1. */
export const EXPERIENCE_BANDS = Object.freeze([
  Object.freeze({ id: 'new', label: '신입 / 0년', years: 0, aliases: Object.freeze(['a', '신입', 'new', '0년']) }),
  Object.freeze({ id: '0-1', label: '0–1년', years: 0.5, aliases: Object.freeze(['b', '0-1', '0–1', '0~1']) }),
  Object.freeze({ id: '1-3', label: '1–3년', years: 2, aliases: Object.freeze(['c', '1-3', '1–3', '1~3']) }),
  Object.freeze({ id: '3-5', label: '3–5년', years: 4, aliases: Object.freeze(['d', '3-5', '3–5', '3~5']) }),
  Object.freeze({ id: '5+', label: '5년 이상', years: 5, aliases: Object.freeze(['e', '5+', '5년', '5년 이상', '5년+']) }),
]);

const EXAMPLE_BLOCKED = new Set(['examplecorp', 'exampleagency']);

function uniqueStrings(items) {
  const out = [];
  const seen = new Set();
  for (const raw of items) {
    const s = String(raw ?? '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function yamlScalar(value) {
  return JSON.stringify(String(value));
}

function yamlListItems(items, indent = '    ') {
  return uniqueStrings(items).map((item) => `${indent}- ${yamlScalar(item)}`).join('\n');
}

function familyByToken(token) {
  const t = String(token ?? '').trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  const idx = Number(t);
  if (Number.isInteger(idx) && idx >= 1 && idx <= JOB_FAMILIES.length) {
    return JOB_FAMILIES[idx - 1];
  }
  return JOB_FAMILIES.find((f) => f.id === lower || f.label.toLowerCase() === lower) || null;
}

/**
 * Parse a comma-separated job-family selection (numbers, ids, or Korean labels).
 * @param {unknown} raw
 * @returns {typeof JOB_FAMILIES[number][]}
 */
export function parseJobFamilies(raw) {
  if (raw == null || String(raw).trim() === '') return [];
  const tokens = String(raw).split(/[,，/|]+/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const token of tokens) {
    const fam = familyByToken(token);
    if (!fam || seen.has(fam.id)) continue;
    seen.add(fam.id);
    out.push(fam);
  }
  return out;
}

/**
 * Split role titles from a comma-separated prompt / `--roles` value.
 * @param {unknown} raw
 * @returns {string[]|null}
 */
export function parseRoles(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const roles = uniqueStrings(String(raw).split(/[,，]/));
  return roles.length ? roles : null;
}

/**
 * Parse experience.years from a band alias or a non-negative number.
 *
 * Interactive numbered menu (1–5) maps to bands. CLI `--years` treats a bare
 * number as years (`--years 1` → 1.0). Band aliases (`신입`, `1-3`, `c`) work
 * in both modes.
 *
 * @param {unknown} raw
 * @param {{ cli?: boolean }} [opts]
 * @returns {{ years: number, band: string|null, source: 'band'|'numeric' }|null}
 */
export function parseExperienceChoice(raw, opts = {}) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  const cli = opts.cli === true;

  const byAlias = EXPERIENCE_BANDS.find((b) => b.id === lower || b.aliases.includes(lower) || b.label === s);
  if (byAlias) return { years: byAlias.years, band: byAlias.id, source: 'band' };

  if (!cli) {
    const menu = Number(s);
    if (Number.isInteger(menu) && menu >= 1 && menu <= EXPERIENCE_BANDS.length && !s.includes('.')) {
      const band = EXPERIENCE_BANDS[menu - 1];
      return { years: band.years, band: band.id, source: 'band' };
    }
  }

  const n = Number(s);
  if (Number.isFinite(n) && n >= 0) return { years: n, band: null, source: 'numeric' };
  return null;
}

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parseYears(raw) {
  const parsed = parseExperienceChoice(raw, { cli: true });
  return parsed ? parsed.years : null;
}

/**
 * Comma- or newline-separated company names. Drops blanks and anything that
 * looks like an email (examples must not grow real PII).
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseBlockedCompanies(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return uniqueStrings(raw).filter((n) => !n.includes('@'));
  const tokens = String(raw)
    .split(/[\n,，;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return uniqueStrings(tokens).filter((n) => !n.includes('@'));
}

export function isExampleBlockedList(names) {
  const list = parseBlockedCompanies(names);
  if (!list.length) return false;
  return list.every((n) => EXAMPLE_BLOCKED.has(n.replace(/[\s."']/g, '').toLowerCase()));
}

/**
 * Combine family presets + optional custom titles into profile/portals fields.
 * @param {typeof JOB_FAMILIES[number][]} families
 * @param {string[]|null|undefined} customRoles
 */
export function targetingFromFamilies(families, customRoles) {
  const fams = Array.isArray(families) ? families.filter((f) => f && f.id !== 'other') : [];
  const custom = parseRoles(Array.isArray(customRoles) ? customRoles.join(',') : customRoles) || [];
  const roles = uniqueStrings([
    ...fams.flatMap((f) => f.roles),
    ...custom,
  ]);
  const titleKeywords = uniqueStrings([
    ...fams.flatMap((f) => f.titleKeywords),
    ...custom,
  ]);
  const boardKeywords = uniqueStrings([
    ...fams.flatMap((f) => f.boardKeywords),
    ...custom,
  ]);
  const searchKeywords = uniqueStrings([
    ...fams.flatMap((f) => f.searchKeywords),
    ...custom,
  ]);
  return { roles, titleKeywords, boardKeywords, searchKeywords };
}

export function replaceFirst(text, re, replacement) {
  if (!re.test(text)) return { text, ok: false };
  return { text: text.replace(re, replacement), ok: true };
}

function replaceIndentedList(text, headerRe, items, indent) {
  if (!items || !items.length) return { text, ok: false };
  const block = yamlListItems(items, indent);
  const r = replaceFirst(text, headerRe, `$1${block}\n`);
  return r;
}

/**
 * Patch shipped-example scalars in profile.yml without dumping YAML.
 * @param {string} text
 * @param {{ full_name?: string|null, email?: string|null, years?: number|null, city?: string|null, roles?: string[]|null, output?: string|null }} fields
 */
export function patchProfileYaml(text, fields) {
  let next = text;
  const applied = [];
  if (fields.full_name) {
    const r = replaceFirst(next, /^(  full_name:\s*)("[^"]*"|[^\n]+)/m, `$1${yamlScalar(fields.full_name)}`);
    next = r.text;
    if (r.ok) applied.push('full_name');
  }
  if (fields.email) {
    const r = replaceFirst(next, /^(  email:\s*)("[^"]*"|[^\n]+)/m, `$1${yamlScalar(fields.email)}`);
    next = r.text;
    if (r.ok) applied.push('email');
  }
  if (fields.years != null) {
    const r = replaceFirst(next, /^(  years:\s*)[^\n]+/m, `$1${fields.years}`);
    next = r.text;
    if (r.ok) applied.push('experience.years');
  }
  if (fields.city) {
    const loc = `${fields.city}, 대한민국`;
    const r1 = replaceFirst(next, /^(  location:\s*)("[^"]*"|[^\n]+)/m, `$1${yamlScalar(loc)}`);
    next = r1.text;
    const r2 = replaceFirst(next, /^(  city:\s*)("[^"]*"|[^\n]+)/m, `$1${yamlScalar(fields.city)}`);
    next = r2.text;
    if (r1.ok || r2.ok) applied.push('location');
  }
  if (Array.isArray(fields.roles) && fields.roles.length > 0) {
    const r = replaceIndentedList(
      next,
      /(target_roles:\n(?:[^\n]*\n)*?  primary:\n)(?:    - [^\n]+\n)+/,
      fields.roles,
      '    ',
    );
    next = r.text;
    if (r.ok) applied.push('target_roles.primary');
  }
  if (fields.output) {
    const r = replaceFirst(next, /^(  output:\s*)[^\n]+/m, `$1${fields.output}`);
    next = r.text;
    if (r.ok) applied.push('language.output');
  }
  if (fields.output === 'ko') {
    const r = replaceFirst(next, /^(  modes_dir:\s*)[^\n]+/m, '$1modes/ko');
    next = r.text;
    if (r.ok) applied.push('language.modes_dir');
  }
  return { text: next, applied };
}

function replaceRootList(text, key, items) {
  const block = items.length
    ? `${key}:\n${yamlListItems(items, '  ')}\n`
    : `${key}: []\n`;
  const re = new RegExp(`^${key}:\\n(?:  - [^\\n]+\\n)+`, 'm');
  const emptyRe = new RegExp(`^${key}:\\s*\\[\\]\\s*\\n`, 'm');
  if (re.test(text)) return { text: text.replace(re, block), ok: true };
  if (emptyRe.test(text)) return { text: text.replace(emptyRe, block), ok: true };
  if (/^job_boards:/m.test(text)) {
    return { text: text.replace(/^job_boards:/m, `${block}\njob_boards:`), ok: true };
  }
  return { text: `${text.replace(/\s*$/, '')}\n\n${block}`, ok: true };
}

function wantedBoardSnippet(keyword) {
  const name = `Wanted — ${keyword}`;
  return [
    `  - name: ${name}`,
    '    provider: wanted',
    '    careers_url: https://www.wanted.co.kr/',
    `    searchKeywords: ${yamlScalar(keyword)}`,
    '    max_pages: 3',
    '    enabled: true',
    '    notes: "Wanted keyword pass from setup 직종 selection."',
    '',
  ].join('\n');
}

/**
 * Enable Wanted boards whose searchKeywords match the selected set; leave
 * Saramin/JobKorea/Remember enabled flags untouched (ToS opt-in).
 * @param {string} text
 * @param {string[]} boardKeywords
 */
export function syncWantedJobBoards(text, boardKeywords) {
  const selected = new Set(uniqueStrings(boardKeywords).map((k) => k.toLowerCase()));
  if (!selected.size) return { text, added: [], toggled: 0 };

  const chunks = text.split(/(?=^  - name: )/m);
  const seen = new Set();
  let toggled = 0;
  const nextChunks = chunks.map((chunk) => {
    if (!/^  - name: /m.test(chunk)) return chunk;
    const provider = (chunk.match(/^\s+provider:\s*(\S+)/m) || [])[1];
    const kwRaw = (chunk.match(/^\s+searchKeywords:\s*(?:"([^"]*)"|(\S+))/m) || []);
    const kw = (kwRaw[1] || kwRaw[2] || '').trim();
    if (provider !== 'wanted' || !kw) return chunk;
    seen.add(kw.toLowerCase());
    const on = selected.has(kw.toLowerCase())
      || [...selected].some((s) => kw.toLowerCase().includes(s) || s.includes(kw.toLowerCase()));
    const replaced = chunk.replace(/^(\s+enabled:\s*)(true|false)/m, (_, prefix) => {
      toggled += 1;
      return `${prefix}${on}`;
    });
    return replaced;
  });

  const missing = uniqueStrings(boardKeywords).filter((k) => !seen.has(k.toLowerCase()));
  let joined = nextChunks.join('');
  if (missing.length) {
    const insert = missing.map(wantedBoardSnippet).join('');
    if (/^  # ── 사람인/m.test(joined)) {
      joined = joined.replace(/^  # ── 사람인/m, `${insert}  # ── 사람인`);
    } else if (/^job_boards:\n/m.test(joined)) {
      joined = joined.replace(/^job_boards:\n/m, `job_boards:\n${insert}`);
    } else {
      joined += `\n${insert}`;
    }
  }
  return { text: joined, added: missing, toggled };
}

/**
 * Patch portals.yml title_filter.positive, Wanted boards, and blocked_companies.
 * @param {string} text
 * @param {{ titleKeywords?: string[]|null, boardKeywords?: string[]|null, blocked?: string[]|null }} fields
 */
export function patchPortalsYaml(text, fields) {
  let next = text;
  const applied = [];

  if (Array.isArray(fields.titleKeywords) && fields.titleKeywords.length) {
    const r = replaceIndentedList(
      next,
      /(title_filter:\n(?:[^\n]*\n)*?  positive:\n)(?:    - [^\n]+\n)+/,
      fields.titleKeywords,
      '    ',
    );
    next = r.text;
    if (r.ok) applied.push('title_filter.positive');
  }

  if (Array.isArray(fields.boardKeywords) && fields.boardKeywords.length) {
    const sync = syncWantedJobBoards(next, fields.boardKeywords);
    next = sync.text;
    if (sync.toggled || sync.added.length) applied.push('job_boards.wanted');
  }

  if (Array.isArray(fields.blocked)) {
    const names = parseBlockedCompanies(fields.blocked);
    const r = replaceRootList(next, 'blocked_companies', names);
    next = r.text;
    if (r.ok) applied.push('blocked_companies');
  }

  return { text: next, applied };
}

export function formatFamilyMenu() {
  return JOB_FAMILIES.map((f, i) => `  ${i + 1}) ${f.label}`).join('\n');
}

export function formatExperienceMenu() {
  return EXPERIENCE_BANDS.map((b, i) => `  ${i + 1}) ${b.label}`).join('\n');
}
