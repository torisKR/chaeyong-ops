#!/usr/bin/env node

/**
 * setup.mjs — One-command Korean onboarding for chaeyong-ops.
 *
 * Copies gitignored user-layer files from the shipped examples when missing:
 *   config/profile.example.yml      → config/profile.yml
 *   templates/portals-kr.example.yml → portals.yml
 *   cv.example.md                   → cv.md
 *   modes/_profile.template.md      → modes/_profile.md
 *
 * Never overwrites an existing user file. `--defaults` is silent (CI / piped
 * stdin). A TTY without `--defaults` prompts for name, email, experience.years,
 * target roles, location, and language.output.
 *
 * Usage:
 *   node setup.mjs                  # interactive on a TTY; --defaults otherwise
 *   node setup.mjs --defaults       # copy only, no prompts
 *   node setup.mjs --target <path>  # write into another checkout (tests)
 *   node setup.mjs --json           # machine-readable copy result
 *   node setup.mjs --help
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import readline from 'node:readline/promises';
import { stdin as stdinStream, stdout as stdoutStream } from 'node:process';
import { validateFlags, hasFlag, flagValue } from './lib/cli-flags.mjs';
import { getCareerOpsRoot } from './path-resolver.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

const KNOWN_FLAGS = ['--defaults', '--json', '--target', '--help', '-h'];
const VALUE_FLAGS = ['--target'];

const USAGE = `Usage:
  node setup.mjs                  # 대화형 (TTY) / 아니면 --defaults 와 동일
  node setup.mjs --defaults       # 예제 복사만. CI·파이프에서 사용
  node setup.mjs --target <path>  # 다른 체크아웃에 복사 (테스트)
  node setup.mjs --json           # JSON 결과
  node setup.mjs --help

복사되는 파일 (없을 때만, 기존 파일은 덮어쓰지 않음):
  config/profile.yml   ← config/profile.example.yml
  portals.yml          ← templates/portals-kr.example.yml
  cv.md                ← cv.example.md
  modes/_profile.md    ← modes/_profile.template.md

필수 수정: 이름, 이메일, experience.years (본인 경력(년) 숫자), 목표 직무, 위치.
개인 데이터는 gitignored 입니다. 공개 저장소에 커밋하지 마세요.
문서: docs/GETTING-STARTED-KR.md · docs/APPLY-KR.md`;

validateFlags(argv, KNOWN_FLAGS, USAGE, { valueFlags: VALUE_FLAGS, requireOperand: true });

const JSON_OUT = hasFlag(argv, '--json');
const DEFAULTS = hasFlag(argv, '--defaults');
const target = flagValue(argv, '--target');
const CODE_ROOT = __dirname;
const DATA_ROOT = target || getCareerOpsRoot();

const COPIES = [
  {
    from: ['config', 'profile.example.yml'],
    to: ['config', 'profile.yml'],
    mkdir: ['config'],
  },
  {
    from: ['templates', 'portals-kr.example.yml'],
    to: ['portals.yml'],
  },
  {
    from: ['cv.example.md'],
    to: ['cv.md'],
  },
  {
    from: ['modes', '_profile.template.md'],
    to: ['modes', '_profile.md'],
    mkdir: ['modes'],
  },
];

/** Placeholder tokens that mean "this is still the shipped example". */
const EXAMPLE_MARKERS = [
  'you.example@example.com',
  '유주환',
  '김예시',
  '010-0000-0000',
];

function looksLikeExampleProfile(text) {
  return EXAMPLE_MARKERS.some((m) => text.includes(m));
}

function copyMissing() {
  const copied = [];
  const skipped = [];
  const missingSources = [];
  for (const spec of COPIES) {
    const src = join(CODE_ROOT, ...spec.from);
    const destDirParts = spec.to.slice(0, -1);
    if (spec.mkdir) {
      mkdirSync(join(DATA_ROOT, ...spec.mkdir), { recursive: true });
    } else if (destDirParts.length) {
      mkdirSync(join(DATA_ROOT, ...destDirParts), { recursive: true });
    }
    const dest = join(DATA_ROOT, ...spec.to);
    const rel = spec.to.join('/');
    if (!existsSync(src)) {
      missingSources.push(spec.from.join('/'));
      continue;
    }
    if (existsSync(dest)) {
      skipped.push(rel);
      continue;
    }
    copyFileSync(src, dest);
    copied.push(rel);
  }
  return { copied, skipped, missingSources };
}

function printNextSteps({ copied, skipped, patched }) {
  const lines = [
    '',
    '다음 단계 / Next:',
    '  1. config/profile.yml 에서 이름·이메일·experience.years 를 본인 값으로 수정',
    '     experience.years = 본인 경력(년) 숫자  (예: 1.7 — 출시 프로젝트는 넣지 마세요)',
    '  2. npm install          # 아직이면',
    '  3. node doctor.mjs      # 설정 확인 (npm run doctor)',
    '  4. npm run scan:kr      # 원티드 스캔 (기본 활성). 또는 node scan.mjs',
    '  5. Cursor / Claude Code 에 채용 공고 URL 붙여넣기  → 평가',
    '',
    '문서: docs/GETTING-STARTED-KR.md  ·  docs/APPLY-KR.md',
    '라이선스: NOTICE.md · LICENSE (MIT). 원티드·사람인·잡코리아 이용약관은 MIT와 별개입니다.',
    '커밋 금지: cv.md, config/profile.yml, portals.yml, data/*  (.gitignore 에 있음)',
  ];
  if (copied.length) {
    lines.unshift(`복사함 / copied: ${copied.join(', ')}`);
  }
  if (skipped.length) {
    lines.unshift(`이미 있음 / already present: ${skipped.join(', ')}`);
  }
  if (patched) {
    lines.unshift('profile.yml 필드를 반영했습니다. 나머지 예제 문구는 직접 고치세요.');
  }
  return lines.join('\n');
}

function replaceFirst(text, re, replacement) {
  if (!re.test(text)) return { text, ok: false };
  return { text: text.replace(re, replacement), ok: true };
}

/**
 * Patch shipped-example scalars in profile.yml without dumping YAML
 * (comments must survive).
 */
function patchProfileYaml(text, fields) {
  let next = text;
  const applied = [];
  if (fields.full_name) {
    const r = replaceFirst(next, /^(  full_name:\s*)("[^"]*"|[^\n]+)/m, `$1${JSON.stringify(fields.full_name)}`);
    next = r.text;
    if (r.ok) applied.push('full_name');
  }
  if (fields.email) {
    const r = replaceFirst(next, /^(  email:\s*)("[^"]*"|[^\n]+)/m, `$1${JSON.stringify(fields.email)}`);
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
    const r1 = replaceFirst(next, /^(  location:\s*)("[^"]*"|[^\n]+)/m, `$1${JSON.stringify(loc)}`);
    next = r1.text;
    const r2 = replaceFirst(next, /^(  city:\s*)("[^"]*"|[^\n]+)/m, `$1${JSON.stringify(fields.city)}`);
    next = r2.text;
    if (r1.ok || r2.ok) applied.push('location');
  }
  if (Array.isArray(fields.roles) && fields.roles.length > 0) {
    const block = fields.roles.map((r) => `    - ${JSON.stringify(r)}`).join('\n');
    const r = replaceFirst(
      next,
      /(target_roles:\n(?:[^\n]*\n)*?  primary:\n)(?:    - [^\n]+\n)+/,
      `$1${block}\n`,
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

function parseYears(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseRoles(raw) {
  if (!raw || !String(raw).trim()) return null;
  const roles = String(raw).split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  return roles.length ? roles : null;
}

async function promptFields() {
  const rl = readline.createInterface({ input: stdinStream, output: stdoutStream });
  try {
    console.log('');
    console.log('필수 필드 — Enter 는 예제 값을 유지합니다. 나중에 profile.yml 에서 고쳐도 됩니다.');
    console.log('Required fields. Enter keeps the example; edit config/profile.yml afterwards if you prefer.');
    console.log('');
    const full_name = (await rl.question('이름 / name: ')).trim();
    const email = (await rl.question('이메일 / email: ')).trim();
    let years = null;
    while (years == null) {
      const raw = (await rl.question('경력(년) / experience.years (본인 경력(년) 숫자, 예: 1.7): ')).trim();
      if (!raw) break;
      years = parseYears(raw);
      if (years == null) console.log('  숫자만 입력하세요. 예: 1.7  /  enter a number like 1.7');
    }
    const rolesRaw = (await rl.question('목표 직무 / target roles (쉼표 구분, 예: 백엔드 개발자, 풀스택 개발자): ')).trim();
    const city = (await rl.question('도시 / city [서울]: ')).trim() || '';
    const outputRaw = (await rl.question('출력 언어 / language.output [ko]: ')).trim().toLowerCase();
    return {
      full_name: full_name || null,
      email: email || null,
      years,
      roles: parseRoles(rolesRaw),
      city: city || null,
      output: outputRaw || 'ko',
    };
  } finally {
    rl.close();
  }
}

function profilePath() {
  return join(DATA_ROOT, 'config', 'profile.yml');
}

async function main() {
  const tty = Boolean(stdinStream.isTTY && stdoutStream.isTTY);
  const interactive = !DEFAULTS && tty && !JSON_OUT;

  if (!JSON_OUT) {
    console.log('\n채용옵스 setup');
    console.log('==============\n');
  }

  const result = copyMissing();
  if (result.missingSources.length && !JSON_OUT) {
    console.error(`예제 파일을 찾지 못했습니다: ${result.missingSources.join(', ')}`);
  }

  let patched = false;
  let applied = [];
  const destProfile = profilePath();
  if (existsSync(destProfile) && interactive) {
    const current = readFileSync(destProfile, 'utf-8');
    const shouldAsk = result.copied.includes('config/profile.yml') || looksLikeExampleProfile(current);
    if (shouldAsk) {
      const fields = await promptFields();
      const { text, applied: keys } = patchProfileYaml(current, fields);
      if (keys.length && text !== current) {
        writeFileSync(destProfile, text, 'utf-8');
        patched = true;
        applied = keys;
      }
    } else if (!JSON_OUT) {
      console.log('config/profile.yml 이 이미 채워져 있어 질문은 건너뜁니다.');
    }
  }

  const payload = {
    copied: result.copied,
    skipped: result.skipped,
    patched,
    applied,
    root: DATA_ROOT,
    next: [
      'Edit config/profile.yml: name, email, experience.years (본인 경력(년) 숫자)',
      'npm install',
      'node doctor.mjs',
      'npm run scan:kr',
      'Paste a job URL in Cursor / Claude Code',
    ],
    docs: ['docs/GETTING-STARTED-KR.md', 'docs/APPLY-KR.md'],
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(payload));
    process.exit(0);
  }

  console.log(printNextSteps({ copied: result.copied, skipped: result.skipped, patched }));
  console.log('');
}

main().catch((err) => {
  console.error('setup.mjs failed:', err.message);
  process.exit(1);
});
