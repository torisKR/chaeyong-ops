// tests/brief-template-resolve.test.mjs — doctor seeds the ko brief template when configured.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { pass, fail, NODE, ROOT } from './helpers.mjs';
import {
  DEFAULT_BRIEF_TEMPLATE,
  KO_BRIEF_TEMPLATE,
  resolveBriefTemplatePath,
} from '../profile-language.mjs';

console.log('\nbrief-template-resolve — ko brief template selection');

const dirs = [];

function runDoctor(cwd) {
  const out = execFileSync(NODE, [join(ROOT, 'doctor.mjs'), '--json', '--target', cwd], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  return JSON.parse(out);
}

try {
  {
    const dir = mkdtempSync(join(tmpdir(), 'cy-brief-ko-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'modes'), { recursive: true });
    mkdirSync(join(dir, 'config'), { recursive: true });
    writeFileSync(join(dir, 'modes', '_brief.template.ko.md'), '# ko brief\n');
    writeFileSync(join(dir, 'modes', '_brief.template.md'), '# en brief\n');
    writeFileSync(join(dir, 'config', 'profile.yml'), 'language:\n  output: ko\n');
    if (resolveBriefTemplatePath(dir) !== KO_BRIEF_TEMPLATE) {
      fail('resolveBriefTemplatePath picks ko template when output is ko');
    } else {
      pass('resolveBriefTemplatePath picks ko template when output is ko');
    }
    const state = runDoctor(dir);
    if ((state.autoCopied || []).includes('modes/_brief.md')) {
      pass('doctor auto-copies modes/_brief.md from ko template');
    } else {
      fail(`doctor did not auto-copy brief: ${JSON.stringify(state.autoCopied)}`);
    }
  }

  {
    const dir = mkdtempSync(join(tmpdir(), 'cy-brief-en-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'modes'), { recursive: true });
    writeFileSync(join(dir, 'modes', '_brief.template.ko.md'), '# ko brief\n');
    writeFileSync(join(dir, 'modes', '_brief.template.md'), '# en brief\n');
    if (resolveBriefTemplatePath(dir) !== DEFAULT_BRIEF_TEMPLATE) {
      fail('resolveBriefTemplatePath defaults to en template');
    } else {
      pass('resolveBriefTemplatePath defaults to en template');
    }
  }
} finally {
  for (const d of dirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* temp */
    }
  }
}
