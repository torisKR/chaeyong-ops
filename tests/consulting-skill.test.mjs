// tests/consulting-skill.test.mjs — repo Agent Skill for Korean job-search consulting
import { pass, fail, ROOT } from './helpers.mjs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('\nchaeyong-ops-consulting skill');

const canonical = join(ROOT, '.agents', 'skills', 'chaeyong-ops-consulting', 'SKILL.md');
const cursor = join(ROOT, '.cursor', 'skills', 'chaeyong-ops-consulting', 'SKILL.md');

if (!existsSync(canonical)) {
  fail('missing .agents/skills/chaeyong-ops-consulting/SKILL.md');
} else {
  const text = readFileSync(canonical, 'utf-8');
  const needs = [
    [/^name:\s*chaeyong-ops-consulting/m, 'name'],
    [/description:/, 'description'],
    [/원티드/, '원티드'],
    [/사람인/, '사람인'],
    [/잡코리아/, '잡코리아'],
    [/리멤버/, '리멤버'],
    [/experience\.years/, 'experience.years'],
    [/target_roles/, 'target_roles'],
    [/blocked_companies/, 'blocked_companies'],
    [/4\.0/, '4.0 gate'],
    [/제출/, 'never submit'],
    [/날조|만들지 않는다|fabricat/i, 'no fabrication'],
  ];
  const missing = needs.filter(([re]) => !re.test(text)).map(([, label]) => label);
  if (missing.length) fail(`consulting SKILL.md missing: ${missing.join(', ')}`);
  else pass('canonical consulting skill has name/description and Korean consulting recipe');
}

if (existsSync(cursor) && readFileSync(cursor, 'utf-8') === readFileSync(canonical, 'utf-8')) {
  pass('Cursor skill copy matches canonical consulting SKILL.md');
} else {
  fail('.cursor/skills/chaeyong-ops-consulting/SKILL.md missing or out of sync');
}

const clis = ['.claude', '.opencode', '.qwen', '.antigravitycli', '.grok', '.kimi'];
const missingCli = clis.filter((d) => !existsSync(join(ROOT, d, 'skills', 'chaeyong-ops-consulting', 'SKILL.md')));
if (missingCli.length) fail(`consulting skill missing on ${missingCli.join(', ')}`);
else pass('consulting skill is installed for supported CLI skill dirs');
