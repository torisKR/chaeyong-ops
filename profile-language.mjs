import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

const DEFAULT_OUTPUT_LANGUAGE = 'en';
export const DEFAULT_BRIEF_TEMPLATE = 'modes/_brief.template.md';
export const KO_BRIEF_TEMPLATE = 'modes/_brief.template.ko.md';

function normalizeOutputLanguage(value) {
  if (typeof value !== 'string') return DEFAULT_OUTPUT_LANGUAGE;
  const language = value.trim();
  if (!language || language.length > 64 || /[\r\n\0]/.test(language)) {
    return DEFAULT_OUTPUT_LANGUAGE;
  }
  return language;
}

/** Parse language.output from profile YAML, falling back to English. */
export function parseOutputLanguage(profileYaml) {
  try {
    const profile = yaml.load(String(profileYaml ?? '')) || {};
    return normalizeOutputLanguage(profile?.language?.output);
  } catch {
    return DEFAULT_OUTPUT_LANGUAGE;
  }
}

/** Resolve which brief template doctor should seed from `config/profile.yml`. */
export function resolveBriefTemplatePath(projectRoot) {
  const profilePath = join(projectRoot, 'config', 'profile.yml');
  let lang = DEFAULT_OUTPUT_LANGUAGE;
  if (existsSync(profilePath)) {
    try {
      lang = parseOutputLanguage(readFileSync(profilePath, 'utf-8'));
    } catch {
      /* keep default */
    }
  }
  const koPath = join(projectRoot, ...KO_BRIEF_TEMPLATE.split('/'));
  if (lang === 'ko' && existsSync(koPath)) {
    return KO_BRIEF_TEMPLATE;
  }
  return DEFAULT_BRIEF_TEMPLATE;
}

/** Build the canonical output-language rule injected into every model prompt. */
export function outputLanguageInstruction(language) {
  const outputLanguage = normalizeOutputLanguage(language);
  return [
    `Write all human-facing output in ${outputLanguage}, including the full A–G`,
    `evaluation and the machine-readable summary's free-text fields, regardless`,
    `of the language of these instructions or the job description. Keep`,
    `market-specific terms when relevant, but explain them in ${outputLanguage}`,
    `when needed. The configured language.output always wins over the job`,
    `description's language.`,
  ].join(' ');
}
