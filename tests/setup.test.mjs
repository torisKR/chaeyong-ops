// tests/setup.test.mjs — node setup.mjs copies Korean user-layer examples
// when missing, never overwrites, and --defaults is silent (no stdin).
import { pass, fail, ROOT, NODE, rmSync } from './helpers.mjs';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as yaml from 'js-yaml';

console.log('\nsetup.mjs — Korean one-command onboarding');

const SETUP = join(ROOT, 'setup.mjs');
const dirs = [];

function runSetup(args, { input } = {}) {
  return spawnSync(NODE, [SETUP, ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 20_000,
    input: input ?? '',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function tmpTarget(label) {
  const dir = mkdtempSync(join(tmpdir(), `co-setup-${label}-`));
  dirs.push(dir);
  return dir;
}

try {
  {
    const r = runSetup(['--help']);
    if (r.status === 0 && /Usage:/.test(r.stdout) && /setup\.mjs/.test(r.stdout)
        && /experience\.years/.test(r.stdout) && /--families/.test(r.stdout) && /--blocked/.test(r.stdout)) {
      pass('--help prints Korean usage with 직종/연차/블랙리스트 flags');
    } else {
      fail(`--help failed: status=${r.status} stdout=${r.stdout.slice(0, 200)}`);
    }
  }

  {
    const r = runSetup(['--bogus']);
    if (r.status !== 0 && /unrecognized flag/.test(r.stderr)) {
      pass('unrecognized flag exits 1');
    } else {
      fail(`bogus flag: status=${r.status} stderr=${r.stderr}`);
    }
  }

  {
    const r = runSetup(['--target', '--json']);
    if (r.status !== 0 && /requires a value/.test(r.stderr + r.stdout)) {
      pass('--target --json does not treat --json as the target path');
    } else {
      fail(`--target --json: status=${r.status} out=${r.stderr}${r.stdout}`);
    }
  }

  {
    const dir = tmpTarget('defaults');
    const r = runSetup(['--defaults', '--json', '--target', dir]);
    let payload;
    try { payload = JSON.parse(r.stdout.trim()); } catch { payload = { _err: r.stdout + r.stderr }; }
    const profile = join(dir, 'config', 'profile.yml');
    const portals = join(dir, 'portals.yml');
    const cv = join(dir, 'cv.md');
    const profMd = join(dir, 'modes', '_profile.md');
    const copied = Array.isArray(payload.copied) ? payload.copied : [];
    const hasAll = ['config/profile.yml', 'portals.yml', 'cv.md', 'modes/_profile.md'].every((p) => copied.includes(p) && existsSync(join(dir, ...p.split('/'))));
    let years = null;
    let wanted = 0;
    try {
      const doc = yaml.load(readFileSync(profile, 'utf-8'));
      years = doc?.experience?.years;
      const boards = yaml.load(readFileSync(portals, 'utf-8'))?.job_boards || [];
      wanted = boards.filter((b) => b?.provider === 'wanted' && b?.enabled === true).length;
    } catch { /* parse fail below */ }
    if (r.status === 0 && hasAll && typeof years === 'number' && wanted > 0 && /김예시|you\.example@example\.com/.test(readFileSync(profile, 'utf-8'))) {
      pass('--defaults copies profile, portals, cv, _profile (Wanted on, experience.years set)');
    } else {
      fail(`--defaults copy incomplete: status=${r.status} payload=${JSON.stringify(payload)} years=${years} wanted=${wanted} exists=${[profile, portals, cv, profMd].map(existsSync)}`);
    }
  }

  {
    const dir = tmpTarget('no-overwrite');
    mkdirSync(join(dir, 'config'), { recursive: true });
    writeFileSync(join(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: "이미있음"\nexperience:\n  years: 9\n');
    const r = runSetup(['--defaults', '--json', '--target', dir]);
    const payload = JSON.parse(r.stdout.trim());
    const kept = readFileSync(join(dir, 'config', 'profile.yml'), 'utf-8');
    if (payload.skipped.includes('config/profile.yml') && kept.includes('이미있음') && payload.copied.includes('portals.yml')) {
      pass('--defaults does not overwrite an existing profile.yml');
    } else {
      fail(`overwrite guard failed: ${JSON.stringify(payload)} file=${kept.slice(0, 80)}`);
    }
  }

  {
    const dir = tmpTarget('non-tty');
    const r = runSetup(['--json', '--target', dir]);
    if (r.status !== 0) {
      fail(`non-TTY without --defaults should still copy: ${r.stderr}`);
    } else {
      const payload = JSON.parse(r.stdout.trim());
      if ((payload.copied || []).includes('portals.yml')) pass('non-TTY without --defaults copies like --defaults (no hang)');
      else fail(`non-TTY copy missing portals: ${JSON.stringify(payload)}`);
    }
  }

  {
    const dir = tmpTarget('flags');
    const r = runSetup([
      '--defaults', '--json', '--target', dir,
      '--years', '4',
      '--families', 'frontend',
      '--blocked', 'ExampleCorp',
    ]);
    if (r.status !== 0) {
      fail(`flag targeting failed: ${r.stderr}${r.stdout}`);
    } else {
      const payload = JSON.parse(r.stdout.trim());
      const profile = yaml.load(readFileSync(join(dir, 'config', 'profile.yml'), 'utf-8'));
      const portals = yaml.load(readFileSync(join(dir, 'portals.yml'), 'utf-8'));
      const years = profile?.experience?.years;
      const primary = profile?.target_roles?.primary || [];
      const blocked = portals?.blocked_companies || [];
      const wantedOn = (portals?.job_boards || []).filter((b) => b?.provider === 'wanted' && b?.enabled === true).map((b) => b.searchKeywords);
      const wantedOff = (portals?.job_boards || []).filter((b) => b?.provider === 'wanted' && b?.enabled === false);
      const saraminOn = (portals?.job_boards || []).some((b) => b?.provider === 'saramin' && b?.enabled === true);
      if (payload.patched && years === 4 && primary.includes('프론트엔드 개발자')
          && blocked.length === 1 && blocked[0] === 'ExampleCorp'
          && wantedOn.includes('프론트엔드') && wantedOff.length > 0 && !saraminOn) {
        pass('--defaults --years/--families/--blocked writes profile + Wanted keywords, leaves Saramin off');
      } else {
        fail(`flag targeting: years=${years} primary=${JSON.stringify(primary)} blocked=${JSON.stringify(blocked)} wantedOn=${JSON.stringify(wantedOn)} patched=${payload.patched} applied=${JSON.stringify(payload.applied)}`);
      }
    }
  }
} catch (e) {
  fail(`setup.mjs tests crashed: ${e.message}`);
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* temp */ } }
}
