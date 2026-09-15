// tests/experience-band.test.mjs — profile-driven tenure filter (not a fixed junior band).
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pass, fail } from './helpers.mjs';
import { buildTitleFilter } from '../title-keywords.mjs';
import {
  resolveExperienceYears,
  titleNegativesForYears,
  mergeExperienceTitleNegatives,
  shouldSkipForExperience,
  parseKoreanHardMinYears,
  applyProfileExperienceToTitleFilter,
  DEFAULT_SENIOR_MIN_YEARS,
} from '../experience-band.mjs';

console.log('\nexperience-band — profile-driven Korean tenure filter');

// ── years resolution ────────────────────────────────────────────────
if (resolveExperienceYears({ years: 1.7 }) === 1.7) pass('years: 1.7 reads as 1.7');
else fail(`years: 1.7 → ${resolveExperienceYears({ years: 1.7 })}`);

if (Math.abs(resolveExperienceYears({ months: 19 }) - 19 / 12) < 1e-9) {
  pass('months: 19 becomes years = 19/12');
} else fail(`months: 19 → ${resolveExperienceYears({ months: 19 })}`);

if (resolveExperienceYears({ years: 4, months: 99 }) === 4) {
  pass('years wins over months when both are set');
} else fail('years should take precedence over months');

if (resolveExperienceYears({}) == null && resolveExperienceYears(null) == null) {
  pass('missing experience does not invent a junior band');
} else fail('empty experience must be null, not a default year count');

if (resolveExperienceYears({ years: -1 }) == null && resolveExperienceYears({ years: 'nope' }) == null) {
  pass('negative / non-numeric years are rejected');
} else fail('invalid years should be null');

// ── title negatives from years ──────────────────────────────────────
const at17 = titleNegativesForYears(1.7);
const needAt17 = ['3~5년', '3년 이상', '4~7년', '5년 이상', '시니어', 'Senior', '리드', 'Lead', '팀장'];
if (needAt17.every(k => at17.includes(k))) pass('years < 3 selects 3년+ and senior title bands');
else fail(`1.7y negatives missing: ${JSON.stringify(needAt17.filter(k => !at17.includes(k)))}`);

const at35 = titleNegativesForYears(3.5);
if (!at35.includes('3~5년') && !at35.includes('3년 이상') && at35.includes('5년 이상') && at35.includes('시니어')) {
  pass('3 ≤ years < 5 keeps 5년+ / senior, drops 3년+');
} else fail(`3.5y negatives = ${JSON.stringify(at35)}`);

const at5 = titleNegativesForYears(5);
if (at5.length === 0) pass('years >= 5 adds no high-tenure title negatives');
else fail(`5y should be empty, got ${JSON.stringify(at5)}`);

if (titleNegativesForYears(null).length === 0 && titleNegativesForYears(undefined).length === 0) {
  pass('null years adds no title negatives');
} else fail('null years leaked tenure negatives');

if (titleNegativesForYears(4, { senior_min_years: 7 }).includes('시니어')
    && titleNegativesForYears(7, { senior_min_years: 7 }).length === 0) {
  pass('senior_min_years override is honoured');
} else fail('senior_min_years override failed');

// ── merge into title_filter ─────────────────────────────────────────
const merged = mergeExperienceTitleNegatives(
  { positive: ['백엔드'], negative: ['인턴'] },
  1.7,
);
if (merged.positive[0] === '백엔드' && merged.negative.includes('인턴') && merged.negative.includes('3년 이상')) {
  pass('merge keeps portals negatives and appends derived tenure bands');
} else fail(`merge = ${JSON.stringify(merged)}`);

const unchanged = mergeExperienceTitleNegatives({ positive: ['백엔드'], negative: ['인턴'] }, null);
if (unchanged.negative?.length === 1 && unchanged.negative[0] === '인턴') {
  pass('merge is a no-op when years are unknown');
} else fail('null years should not rewrite title_filter');

const filter17 = buildTitleFilter(mergeExperienceTitleNegatives({ positive: ['백엔드'] }, 1.7));
if (!filter17('시니어 백엔드') && !filter17('백엔드 (3년 이상)') && filter17('백엔드 개발자')) {
  pass('derived filter rejects high-tenure titles and keeps unbanded backend');
} else fail('derived title filter mismatch at 1.7y');

const filter5 = buildTitleFilter(mergeExperienceTitleNegatives({ positive: ['백엔드'] }, 5));
if (filter5('시니어 백엔드') && filter5('백엔드 (3년 이상)')) {
  pass('5y+ profile does not veto senior / 3년+ titles');
} else fail('5y+ profile still applied junior-only negatives');

// ── SKIP vs profile years ───────────────────────────────────────────
const skip3 = shouldSkipForExperience({ years: 1.7, jdHardMinYears: 3 });
if (skip3.skip && skip3.reason === 'jd-min-exceeds-profile') {
  pass('JD hard-min 3y SKIP at profile 1.7y');
} else fail(`1.7 vs 3 → ${JSON.stringify(skip3)}`);

const tolerate = shouldSkipForExperience({
  years: 2.6,
  jdHardMinYears: 3,
  experience: { skip_tolerance_years: 0.5 },
});
if (!tolerate.skip) pass('tolerance 0.5 lets 2.6y through a 3y hard-min');
else fail(`2.6 vs 3 + 0.5 should not skip: ${JSON.stringify(tolerate)}`);

const midOk = shouldSkipForExperience({ years: 4, jdHardMinYears: 3 });
if (!midOk.skip) pass('4y profile is in-band for a 3y hard-min');
else fail('4y vs 3y should not skip');

const seniorSkip = shouldSkipForExperience({ years: 1.7, jdSeniorMustHave: true });
if (seniorSkip.skip && seniorSkip.reason === 'senior-ownership-above-profile') {
  pass('must-have senior ownership SKIP below senior_min_years');
} else fail(`senior must-have at 1.7 → ${JSON.stringify(seniorSkip)}`);

const seniorOk = shouldSkipForExperience({
  years: DEFAULT_SENIOR_MIN_YEARS,
  jdSeniorMustHave: true,
});
if (!seniorOk.skip) pass('senior ownership is in-band at senior_min_years');
else fail('5y+ should not skip senior-must-have by default');

const unknown = shouldSkipForExperience({ years: null, jdHardMinYears: 3, jdSeniorMustHave: true });
if (!unknown.skip && unknown.reason === 'years-unknown') {
  pass('unknown years never auto-SKIP');
} else fail(`unknown years → ${JSON.stringify(unknown)}`);

if (parseKoreanHardMinYears('경력 3년 이상') === 3
    && parseKoreanHardMinYears('백엔드 (4~7년)') === 4
    && parseKoreanHardMinYears('5 years of experience') === 5
    && parseKoreanHardMinYears('우대 사항만') == null) {
  pass('parseKoreanHardMinYears reads 이상 / range / English years');
} else fail('JD year parser mismatch');

// ── profile.yml load ────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'experience-band-'));
try {
  writeFileSync(join(dir, 'profile.yml'), 'experience:\n  years: 1.7\n', 'utf8');
  const fromFile = applyProfileExperienceToTitleFilter({ positive: ['백엔드'] }, join(dir, 'profile.yml'));
  if (fromFile.negative?.includes('3년 이상') && fromFile.negative?.includes('시니어')) {
    pass('applyProfileExperienceToTitleFilter reads experience.years from a profile file');
  } else fail(`file merge = ${JSON.stringify(fromFile)}`);

  writeFileSync(join(dir, 'empty.yml'), 'candidate:\n  full_name: Example\n', 'utf8');
  const noYears = applyProfileExperienceToTitleFilter({ negative: ['인턴'] }, join(dir, 'empty.yml'));
  if (noYears.negative?.length === 1 && noYears.negative[0] === '인턴') {
    pass('profile without experience.years does not inject tenure negatives');
  } else fail(`empty profile merge = ${JSON.stringify(noYears)}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
