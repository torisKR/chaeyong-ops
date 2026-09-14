// Shared CLI skill entrypoint bootstrap — used by npx init and update-system.
// Ensures every supported CLI gets .*/skills/{skill-id}/SKILL.md even when the
// cloned release predates a CLI (e.g. Grok on v1.13.0). Materializes pointer
// files to canonical content on filesystems without symlink support.
//
// skill-id is career-ops upstream, or chaeyong-ops on this branded fork.
// Functions that take `root` detect the id from that tree so fixture tests
// that plant a career-ops layout still exercise the original paths.
import { readFileSync, writeFileSync, existsSync, mkdirSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const SKILL_CLIS = [
  '.claude',
  '.cursor',
  '.opencode',
  '.qwen',
  '.antigravitycli',
  '.grok',
  '.kimi',
];

export function detectSkillId(root) {
  if (existsSync(join(root, '.agents', 'skills', 'chaeyong-ops', 'SKILL.md'))) return 'chaeyong-ops';
  if (existsSync(join(root, '.agents', 'skills', 'career-ops', 'SKILL.md'))) return 'career-ops';
  return 'career-ops';
}

export function skillPathsFor(skillId) {
  const canonical = `.agents/skills/${skillId}/SKILL.md`;
  const pointer = `../../../${canonical}`;
  return {
    id: skillId,
    canonical,
    pointer,
    slash: `/${skillId}`,
    entrypoints: SKILL_CLIS.map((cli) => ({
      path: `${cli}/skills/${skillId}/SKILL.md`,
      pointer,
    })),
  };
}

export function skillPathsAt(root) {
  return skillPathsFor(detectSkillId(root));
}

// Repo-level defaults (this checkout). Fixture tests must use skillPathsAt(root).
const repoSkill = skillPathsAt(THIS_REPO);
export const CANONICAL_SKILL_PATH = repoSkill.canonical;
export const SKILL_ENTRYPOINTS = repoSkill.entrypoints;

function repoPath(root, path) {
  return join(root, ...path.split('/'));
}

function readCanonical(root, canonicalRel = skillPathsAt(root).canonical) {
  const canonicalPath = repoPath(root, canonicalRel);
  if (!existsSync(canonicalPath)) return null;
  try {
    return readFileSync(canonicalPath, 'utf-8');
  } catch {
    return null;
  }
}

export function materializeSkillEntrypoints(root) {
  const { entrypoints, canonical } = skillPathsAt(root);
  const canonicalContent = readCanonical(root, canonical);
  if (canonicalContent === null) return [];

  const materialized = [];
  for (const entry of entrypoints) {
    const entryPath = repoPath(root, entry.path);
    if (!existsSync(entryPath)) continue;

    let stat = null;
    try {
      stat = lstatSync(entryPath);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;
    if (!stat.isFile()) continue;

    try {
      const content = readFileSync(entryPath, 'utf-8').trim();
      if (content !== entry.pointer) continue;
      writeFileSync(entryPath, canonicalContent);
    } catch {
      continue;
    }
    materialized.push(entry.path);
  }

  return materialized;
}

export function ensureSkillEntrypoints(root) {
  const { entrypoints, canonical } = skillPathsAt(root);
  const canonicalContent = readCanonical(root, canonical);
  if (canonicalContent === null) return [];

  const touched = [];
  for (const entry of entrypoints) {
    const entryPath = repoPath(root, entry.path);

    if (!existsSync(entryPath)) {
      try {
        mkdirSync(dirname(entryPath), { recursive: true });
        writeFileSync(entryPath, entry.pointer);
        touched.push(entry.path);
      } catch {
        continue;
      }
    }

    let stat = null;
    try {
      stat = lstatSync(entryPath);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;
    if (!stat.isFile()) continue;

    try {
      const content = readFileSync(entryPath, 'utf-8').trim();
      if (content !== entry.pointer) continue;
      writeFileSync(entryPath, canonicalContent);
      if (!touched.includes(entry.path)) touched.push(entry.path);
    } catch {
      continue;
    }
  }

  return touched;
}
