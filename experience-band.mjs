// experience-band.mjs — profile-driven Korean experience filtering.
//
// Scan title-band negatives and gonggo SKIP are derived from
// `config/profile.yml` → `experience.years` (or `months / 12`). There is no
// hardcoded junior-only band: a 1.7y profile excludes 3년+/시니어 titles; a
// 5y+ profile does not. Missing years means "do not invent a band".
//
// This module is import-safe from scan.mjs, scan-ats-full.mjs, and
// openrouter-runner.mjs. It must not import scan.mjs (scan creates data/ at
// import time).

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { getCareerOpsRoot } from './path-resolver.mjs';

export const DEFAULT_SKIP_TOLERANCE_YEARS = 0.5;
export const DEFAULT_SENIOR_MIN_YEARS = 5;

/** Title keywords applied when profile years are below `minYears`. */
export const TITLE_BANDS = [
  { minYears: 3, keywords: ['3~5년', '3년 이상'] },
  { minYears: 4, keywords: ['4~7년'] },
  { minYears: 5, keywords: ['5년 이상'] },
];

/** Senior-ownership title markers. Applied when years < senior_min_years. */
export const SENIOR_TITLE_KEYWORDS = ['시니어', 'Senior', '리드', 'Lead', '팀장'];

export function defaultProfilePath(dataRoot = getCareerOpsRoot()) {
  return process.env.CAREER_OPS_PROFILE || path.join(dataRoot, 'config', 'profile.yml');
}

function finiteNonNegative(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * @param {unknown} experience - `profile.experience` mapping
 * @returns {number|null} years, or null when unset/unusable
 */
export function resolveExperienceYears(experience) {
  if (!experience || typeof experience !== 'object' || Array.isArray(experience)) return null;
  const years = finiteNonNegative(experience.years);
  if (years != null) return years;
  const months = finiteNonNegative(experience.months);
  if (months != null) return months / 12;
  return null;
}

export function resolveSkipToleranceYears(experience) {
  const n = finiteNonNegative(experience?.skip_tolerance_years);
  return n != null ? n : DEFAULT_SKIP_TOLERANCE_YEARS;
}

export function resolveSeniorMinYears(experience) {
  const n = finiteNonNegative(experience?.senior_min_years);
  return n != null ? n : DEFAULT_SENIOR_MIN_YEARS;
}

/**
 * High-tenure title negatives for a given year count.
 * years < 3 → 3년+ and senior titles; years >= 5 (default senior min) → none.
 *
 * @param {number|null|undefined} years
 * @param {object} [experience]
 * @returns {string[]}
 */
export function titleNegativesForYears(years, experience = {}) {
  if (years == null || !Number.isFinite(years)) return [];
  const seniorMin = resolveSeniorMinYears(experience);
  const out = [];
  for (const band of TITLE_BANDS) {
    if (years < band.minYears) out.push(...band.keywords);
  }
  if (years < seniorMin) out.push(...SENIOR_TITLE_KEYWORDS);
  return [...new Set(out)];
}

/**
 * Return a new title_filter with profile-derived negatives appended.
 * Does not mutate `titleFilter`. Missing years leaves the filter unchanged.
 *
 * @param {{positive?: unknown, negative?: unknown}|null|undefined} titleFilter
 * @param {number|null|undefined} years
 * @param {object} [experience]
 */
export function mergeExperienceTitleNegatives(titleFilter, years, experience = {}) {
  const extra = titleNegativesForYears(years, experience);
  if (extra.length === 0) return titleFilter;
  const base = titleFilter && typeof titleFilter === 'object' ? titleFilter : {};
  const existing = Array.isArray(base.negative) ? base.negative.filter(k => typeof k === 'string') : [];
  const seen = new Set(existing.map(k => k.trim().toLowerCase()).filter(Boolean));
  const merged = [...existing];
  for (const kw of extra) {
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(kw);
  }
  return { ...base, negative: merged };
}

/**
 * First stated hard-min years from Korean/English JD phrasing, or null.
 * Preferred/우대 lines are the caller's job to ignore — this is a parser.
 */
export function parseKoreanHardMinYears(text) {
  const s = String(text ?? '');
  const plus = s.match(/(\d+(?:\.\d+)?)\s*년\s*이상/);
  if (plus) return Number(plus[1]);
  const range = s.match(/(\d+(?:\.\d+)?)\s*[~～\-–]\s*\d+(?:\.\d+)?\s*년/);
  if (range) return Number(range[1]);
  const career = s.match(/경력\s*(\d+(?:\.\d+)?)\s*년/);
  if (career) return Number(career[1]);
  const en = s.match(/(\d+(?:\.\d+)?)\s*\+?\s*years?(?:\s+of\s+experience)?/i);
  if (en) return Number(en[1]);
  return null;
}

/**
 * Evaluation SKIP when JD hard-min exceeds profile years (+ tolerance),
 * or senior lead/architect ownership is must-have below senior_min_years.
 *
 * @returns {{skip: boolean, reason: string}}
 */
export function shouldSkipForExperience({
  years,
  jdHardMinYears = null,
  jdSeniorMustHave = false,
  experience = {},
} = {}) {
  if (years == null || !Number.isFinite(years)) {
    return { skip: false, reason: 'years-unknown' };
  }
  const tolerance = resolveSkipToleranceYears(experience);
  const seniorMin = resolveSeniorMinYears(experience);
  if (typeof jdHardMinYears === 'number' && Number.isFinite(jdHardMinYears)
      && jdHardMinYears > years + tolerance) {
    return { skip: true, reason: 'jd-min-exceeds-profile' };
  }
  if (jdSeniorMustHave && years < seniorMin) {
    return { skip: true, reason: 'senior-ownership-above-profile' };
  }
  return { skip: false, reason: 'in-band' };
}

export function loadExperienceBlock(profilePath) {
  if (!profilePath || !existsSync(profilePath)) return {};
  try {
    const raw = yaml.load(readFileSync(profilePath, 'utf-8'));
    const exp = raw?.experience;
    return exp && typeof exp === 'object' && !Array.isArray(exp) ? exp : {};
  } catch {
    return {};
  }
}

/**
 * Merge profile-derived tenure negatives into a portals.yml title_filter.
 */
export function applyProfileExperienceToTitleFilter(titleFilter, profilePath = defaultProfilePath()) {
  const experience = loadExperienceBlock(profilePath);
  return mergeExperienceTitleNegatives(titleFilter, resolveExperienceYears(experience), experience);
}
