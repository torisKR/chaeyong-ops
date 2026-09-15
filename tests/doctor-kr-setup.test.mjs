// tests/doctor-kr-setup.test.mjs — Korean onboarding checks on this fork.
import { pass, fail, ROOT, NODE, rmSync } from './helpers.mjs';
import { execFileSync, spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

console.log('\ndoctor.mjs — Korean setup checks (experience.years, Wanted)');

const DOCTOR = join(ROOT, 'doctor.mjs');
const dirs = [];

function runDoctor(cwd) {
  try {
    const out = execFileSync(NODE, [DOCTOR, '--json', '--target', cwd], {
      cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return JSON.parse(out);
  } catch (e) {
    return { _error: e.message, stderr: String(e.stderr || '') };
  }
}

function fixture(label, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), `co-doctor-kr-${label}-`));
  dirs.push(dir);
  mkdirSync(join(dir, 'config'), { recursive: true });
  mkdirSync(join(dir, 'modes'), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    const parts = rel.split('/');
    if (parts.length > 1) mkdirSync(join(dir, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(dir, ...parts), body);
  }
  return dir;
}

const PREREQS = {
  'cv.md': '# 김테스트\n\n## 경력\n\n### 회사 — 개발자\n',
  'config/profile.yml': 'candidate:\n  full_name: "김테스트"\n  email: "a@b.co"\nexperience:\n  years: 1.7\nlanguage:\n  output: ko\n',
  'modes/_profile.md': '# Profile\n백엔드 개발자.\n',
  'portals.yml': 'job_boards:\n  - name: Wanted — 백엔드\n    provider: wanted\n    enabled: true\n',
};

try {
  {
    const dir = fixture('missing');
    const s = runDoctor(dir);
    if (s._error) fail(`missing: crashed ${s._error}`);
    else if (s.onboardingNeeded === true && (s.missing || []).includes('config/profile.yml')) {
      const human = spawnSync(NODE, [DOCTOR, '--target', dir], {
        cwd: ROOT, encoding: 'utf-8', timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'],
      });
      const all = `${human.stdout || ''}${human.stderr || ''}`;
      if (/setup\.mjs/.test(all) && /없음/.test(all)) {
        pass('missing profile: onboardingNeeded + Korean setup.mjs hint in human output');
      } else {
        fail(`human doctor missing Korean setup hint: ${all.slice(0, 400)}`);
      }
    } else {
      fail(`missing hint absent: ${JSON.stringify(s)}`);
    }
  }

  {
    const dir = fixture('years-missing', {
      ...PREREQS,
      'config/profile.yml': 'candidate:\n  full_name: "김테스트"\n  email: "a@b.co"\n',
    });
    const s = runDoctor(dir);
    if (s._error) fail(`years-missing crashed: ${s._error}`);
    else if (s.onboardingNeeded === false && s.experienceYears == null
      && (s.warnings || []).some((w) => /experience\.years/.test(String(w)))) {
      pass('profile without experience.years warns in Korean and does not gate onboarding');
    } else {
      fail(`years warning missing: ${JSON.stringify({ onboardingNeeded: s.onboardingNeeded, experienceYears: s.experienceYears, warnings: s.warnings })}`);
    }
  }

  {
    const dir = fixture('wanted-off', {
      ...PREREQS,
      'portals.yml': 'job_boards:\n  - name: Wanted — 백엔드\n    provider: wanted\n    enabled: false\n',
    });
    const s = runDoctor(dir);
    if (s._error) fail(`wanted-off crashed: ${s._error}`);
    else if (s.onboardingNeeded === false && s.wantedEnabled === false
      && (s.warnings || []).some((w) => /원티드|Wanted/.test(String(w)))) {
      pass('Wanted disabled: Korean warning, onboarding still false');
    } else {
      fail(`wanted warning missing: ${JSON.stringify({ wantedEnabled: s.wantedEnabled, warnings: s.warnings })}`);
    }
  }

  {
    const dir = fixture('ready', PREREQS);
    const s = runDoctor(dir);
    if (s._error) fail(`ready crashed: ${s._error}`);
    else if (s.onboardingNeeded === false && s.experienceYears === 1.7 && s.wantedEnabled === true) {
      pass('complete KR profile reports experienceYears + wantedEnabled');
    } else {
      fail(`ready JSON: ${JSON.stringify({ onboardingNeeded: s.onboardingNeeded, experienceYears: s.experienceYears, wantedEnabled: s.wantedEnabled, missing: s.missing })}`);
    }
    if ((s.warnings || []).some((w) => /applications\.md/.test(String(w)) && /대시보드/.test(String(w)))) {
      pass('missing tracker warns before suggesting dashboard');
    } else {
      fail(`tracker dashboard warning missing: ${JSON.stringify(s.warnings)}`);
    }
  }

  {
    const dir = fixture('with-tracker', {
      ...PREREQS,
      'data/applications.md': '# Applications Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|------|---------|------|-------|--------|-----|--------|-------|\n| 1 | 2026-03-02 | 예시테크 | 백엔드 개발자 | 4.2/5 | Applied | ❌ | — | 허구 |\n',
    });
    const s = runDoctor(dir);
    if (s._error) fail(`with-tracker crashed: ${s._error}`);
    else if (!(s.warnings || []).some((w) => /applications\.md/.test(String(w)))) {
      pass('existing tracker does not warn about empty dashboard');
    } else {
      fail(`unexpected tracker warning: ${JSON.stringify(s.warnings)}`);
    }
  }

  {
    const out = execFileSync(NODE, [DOCTOR, '--help'], {
      cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (/setup\.mjs/.test(out) && /Usage:/.test(out)) pass('doctor --help mentions setup.mjs');
    else fail(`doctor --help missing setup: ${out.slice(0, 300)}`);
  }
} catch (e) {
  fail(`doctor-kr-setup tests crashed: ${e.message}`);
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* temp */ } }
}
