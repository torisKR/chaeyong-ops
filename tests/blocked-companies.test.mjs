// tests/blocked-companies.test.mjs — portals.yml skip-list unions with blacklist.md
import { pass, fail, ROOT } from './helpers.mjs';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import * as yaml from 'js-yaml';
import {
  parseBlockedCompanyList,
  parsePortalsBlockedCompanies,
  mergeCompanyBlocklists,
  companyIsBlocked,
} from '../blocked-companies.mjs';
import { parseBlacklist } from '../scan.mjs';

console.log('\nblocked-companies — portals.yml skip-list');

const fromList = parseBlockedCompanyList(['ExampleCorp', 'Example Agency', 'ExampleCorp'], 'portals.yml blocked_companies');
if (fromList.size === 2 && fromList.has('examplecorp') && fromList.has('exampleagency')) {
  pass('parses unique names and folds ExampleCorp / Example Agency');
} else {
  fail(`parseBlockedCompanyList keys: ${[...fromList.keys()].join(',')}`);
}

if (parseBlockedCompanyList(null).size === 0 && parseBlockedCompanyList([]).size === 0) {
  pass('absent / empty list is a no-op');
} else fail('empty list must be an empty Map');

if (parseBlockedCompanyList(['  ', 12, { name: 'nope' }]).size === 0) {
  pass('non-string / blank entries are ignored');
} else fail('non-strings leaked into the Map');

const portals = parsePortalsBlockedCompanies({
  blocked_companies: ['ExampleCorp'],
  exclude_companies: ['Globex Inc.'],
});
if (portals.size === 2 && companyIsBlocked('example corp.', portals) && companyIsBlocked('Globex Inc', portals)) {
  pass('blocked_companies + exclude_companies union; punctuation-insensitive match');
} else fail(`portals parse: ${JSON.stringify([...portals.keys()])}`);

if (!companyIsBlocked('Unrelated Co', portals) && !companyIsBlocked('', portals)) {
  pass('unlisted company is not blocked');
} else fail('false positive on an unlisted name');

const md = parseBlacklist(`
| Company | Since | Scope | Reason |
|---------|-------|-------|--------|
| Acme Corp | 2026-01-15 | company | process |
`);
const merged = mergeCompanyBlocklists(md, parsePortalsBlockedCompanies({ blocked_companies: ['Acme Corp.', 'ExampleCorp'] }));
if (merged.get('acmecorp')?.reason === 'process' && merged.get('examplecorp')?.reason.includes('blocked_companies')) {
  pass('markdown blacklist reason wins on overlap; portals-only names still merge in');
} else fail(`merge reasons: acme=${merged.get('acmecorp')?.reason} ex=${merged.get('examplecorp')?.reason}`);

const krPath = join(ROOT, 'templates', 'portals-kr.example.yml');
const kr = yaml.load(readFileSync(krPath, 'utf-8'));
const names = (kr?.blocked_companies || []).map((n) => String(n));
if (names.includes('ExampleCorp') && names.some((n) => /Example Agency/i.test(n))) {
  pass('portals-kr.example.yml ships fictional ExampleCorp / Example Agency');
} else fail(`blocked_companies = ${JSON.stringify(names)}`);

const raw = readFileSync(krPath, 'utf-8');
if (/이전 직장|former employer/i.test(raw) && !/@gmail\.com/.test(raw)) {
  pass('example documents former-employer use without personal emails');
} else fail('portals-kr.example.yml missing skip-list comment or leaked an email');

const applyKr = readFileSync(join(ROOT, 'docs', 'APPLY-KR.md'), 'utf-8');
const gs = readFileSync(join(ROOT, 'docs', 'GETTING-STARTED-KR.md'), 'utf-8');
if (/blocked_companies/.test(applyKr) && /blocked_companies/.test(gs) && /ExampleCorp/.test(applyKr)) {
  pass('APPLY-KR + GETTING-STARTED document blocked_companies');
} else fail('docs missing blocked_companies');

const tmpYml = join(mkdtempSync(join(tmpdir(), 'co-blocked-val-')), 'portals.yml');
writeFileSync(tmpYml, 'blocked_companies: ExampleCorp\n', 'utf-8');
const bad = spawnSync(process.execPath, ['validate-portals.mjs', '--file', tmpYml], {
  cwd: ROOT, encoding: 'utf-8', timeout: 15_000,
});
if (bad.status !== 0 && /blocked_companies must be an array/.test(`${bad.stdout}${bad.stderr}`)) {
  pass('validate-portals rejects a non-array blocked_companies');
} else fail(`validate-portals non-array: status=${bad.status} ${(bad.stderr || bad.stdout || '').slice(0, 300)}`);