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
 * stdin). A TTY without `--defaults` prompts for name, email, 직종, 연차,
 * blocked companies, location, and language.output.
 *
 * Usage:
 *   node setup.mjs                  # interactive on a TTY; --defaults otherwise
 *   node setup.mjs --defaults       # copy only, no prompts
 *   node setup.mjs --configure      # re-prompt 직종/연차/블랙리스트
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
import {
  formatExperienceMenu,
  formatFamilyMenu,
  parseBlockedCompanies,
  parseExperienceChoice,
  parseJobFamilies,
  parseRoles,
  patchPortalsYaml,
  patchProfileYaml,
  targetingFromFamilies,
} from './lib/setup-targeting.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

const KNOWN_FLAGS = [
  '--defaults', '--json', '--target', '--help', '-h',
  '--configure', '--interactive',
  '--years', '--families', '--roles', '--blocked',
];
const VALUE_FLAGS = ['--target', '--years', '--families', '--roles', '--blocked'];

const USAGE = `Usage:
  node setup.mjs                  # 대화형 (TTY) / 아니면 --defaults 와 동일
  node setup.mjs --defaults       # 예제 복사만. CI·파이프에서 사용
  node setup.mjs --configure      # 직종·연차·블랙리스트만 다시 묻기
  node setup.mjs --years 1.7 --families backend,frontend --blocked ExampleCorp
  node setup.mjs --target <path>  # 다른 체크아웃에 복사 (테스트)
  node setup.mjs --json           # JSON 결과
  node setup.mjs --help

복사되는 파일 (없을 때만, 기존 파일은 덮어쓰지 않음):
  config/profile.yml   ← config/profile.example.yml
  portals.yml          ← templates/portals-kr.example.yml
  cv.md                ← cv.example.md
  modes/_profile.md    ← modes/_profile.template.md

필수 수정: 이름, 이메일, 직종(target_roles.primary), experience.years (본인 경력(년) 숫자),
블랙리스트(portals.yml blocked_companies), 위치.
개인 데이터는 gitignored 입니다. 공개 저장소에 커밋하지 마세요.
문서: docs/GETTING-STARTED-KR.md · docs/APPLY-KR.md`;

validateFlags(argv, KNOWN_FLAGS, USAGE, { valueFlags: VALUE_FLAGS, requireOperand: true });

const JSON_OUT = hasFlag(argv, '--json');
const DEFAULTS = hasFlag(argv, '--defaults');
const CONFIGURE = hasFlag(argv, '--configure');
const FORCE_INTERACTIVE = hasFlag(argv, '--interactive');
const target = flagValue(argv, '--target');
const FLAG_YEARS = flagValue(argv, '--years');
const FLAG_FAMILIES = flagValue(argv, '--families');
const FLAG_ROLES = flagValue(argv, '--roles');
const FLAG_BLOCKED = flagValue(argv, '--blocked');
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
    '  1. 직종·연차·블랙리스트는 방금 고른 값이 config/profile.yml 과 portals.yml 에 있습니다',
    '     다시 고치려면: node setup.mjs --configure',
    '     experience.years = 본인 경력(년) 숫자  (예: 1.7 — 출시 프로젝트는 넣지 마세요)',
    '  2. npm install          # 아직이면',
    '  3. node doctor.mjs      # 설정 확인 (npm run doctor)',
    '  4. npm run scan:kr      # 원티드 스캔 (기본 활성). 또는 node scan.mjs',
    '  5. Cursor / Claude Code 에 채용 공고 URL 붙여넣기  → 평가',
    '     취업 상담: chaeyong-ops-consulting 스킬 (.agents/skills/chaeyong-ops-consulting/)',
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
    lines.unshift('profile.yml / portals.yml 필드를 반영했습니다. 나머지 예제 문구는 직접 고치세요.');
  }
  return lines.join('\n');
}

function flagsFromArgv() {
  const yearsParsed = FLAG_YEARS != null ? parseExperienceChoice(FLAG_YEARS, { cli: true }) : null;
  const families = parseJobFamilies(FLAG_FAMILIES);
  const customRoles = parseRoles(FLAG_ROLES);
  const fromFamilies = targetingFromFamilies(families, customRoles);
  const blockedSpecified = FLAG_BLOCKED !== undefined;
  return {
    years: yearsParsed ? yearsParsed.years : null,
    roles: fromFamilies.roles.length ? fromFamilies.roles : customRoles,
    titleKeywords: fromFamilies.titleKeywords,
    boardKeywords: fromFamilies.boardKeywords,
    blocked: blockedSpecified ? parseBlockedCompanies(FLAG_BLOCKED) : null,
    hasTargeting: Boolean(
      yearsParsed
      || fromFamilies.roles.length
      || customRoles?.length
      || blockedSpecified,
    ),
  };
}

async function promptFields({ targetingOnly }) {
  const rl = readline.createInterface({ input: stdinStream, output: stdoutStream });
  try {
    console.log('');
    if (targetingOnly) {
      console.log('직종 · 연차 · 블랙리스트 — Enter 는 건너뜁니다. config/profile.yml / portals.yml 에서 고쳐도 됩니다.');
    } else {
      console.log('필수 필드 — Enter 는 예제 값을 유지합니다. 나중에 profile.yml 에서 고쳐도 됩니다.');
      console.log('Required fields. Enter keeps the example; edit config/profile.yml afterwards if you prefer.');
    }
    console.log('');

    let full_name = null;
    let email = null;
    let city = null;
    let output = targetingOnly ? null : 'ko';

    if (!targetingOnly) {
      full_name = (await rl.question('이름 / name: ')).trim() || null;
      email = (await rl.question('이메일 / email: ')).trim() || null;
    }

    console.log('직종(job family) — 여러 개면 쉼표 (예: 1,3 또는 백엔드,프론트엔드)');
    console.log(formatFamilyMenu());
    const familiesRaw = (await rl.question('선택 / families: ')).trim();
    const families = parseJobFamilies(familiesRaw);
    let customRoles = null;
    if (families.some((f) => f.id === 'other') || (!families.length && familiesRaw && !parseRoles(familiesRaw))) {
      customRoles = parseRoles((await rl.question('기타 직무 직접 입력 (쉼표 구분): ')).trim());
    }
    const freeRoles = families.length ? null : parseRoles(familiesRaw);
    const targeting = targetingFromFamilies(families, customRoles || freeRoles);

    console.log('');
    console.log('연차(experience.years) — 번호(1–5) 또는 숫자 (예: 1.7). 1만 입력하면 신입 밴드, 1년은 1.0');
    console.log(formatExperienceMenu());
    let years = null;
    while (years == null) {
      const raw = (await rl.question('선택 / years: ')).trim();
      if (!raw) break;
      const parsed = parseExperienceChoice(raw, { cli: false });
      if (parsed) {
        years = parsed.years;
        break;
      }
      console.log('  번호 1–5, 밴드(신입, 1-3), 또는 숫자(예: 1.7)를 입력하세요.');
    }

    console.log('');
    console.log('블랙리스트 기업 — 지원하지 않을 회사 (쉼표 또는 여러 줄). 빈 입력이면 건너뜀.');
    console.log('실명 이메일·전화번호는 넣지 마세요. 예: ExampleCorp, Example Agency');
    const blockedRaw = (await rl.question('회사 / blocked_companies: ')).trim();
    const blocked = blockedRaw === '' ? null : parseBlockedCompanies(blockedRaw);

    if (!targetingOnly) {
      city = (await rl.question('도시 / city [서울]: ')).trim() || null;
      const outputRaw = (await rl.question('출력 언어 / language.output [ko]: ')).trim().toLowerCase();
      output = outputRaw || 'ko';
    }

    return {
      full_name,
      email,
      years,
      roles: targeting.roles.length ? targeting.roles : freeRoles,
      titleKeywords: targeting.titleKeywords,
      boardKeywords: targeting.boardKeywords,
      blocked,
      city,
      output,
    };
  } finally {
    rl.close();
  }
}

function profilePath() {
  return join(DATA_ROOT, 'config', 'profile.yml');
}

function portalsPath() {
  return join(DATA_ROOT, 'portals.yml');
}

function mergeFields(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    if (v == null) continue;
    if (Array.isArray(v) && v.length === 0 && k !== 'blocked') continue;
    out[k] = v;
  }
  return out;
}

function applyPatches(fields) {
  const applied = [];
  let patched = false;
  const destProfile = profilePath();
  if (existsSync(destProfile)) {
    const current = readFileSync(destProfile, 'utf-8');
    const { text, applied: keys } = patchProfileYaml(current, fields);
    if (keys.length && text !== current) {
      writeFileSync(destProfile, text, 'utf-8');
      patched = true;
      applied.push(...keys);
    }
  }
  const destPortals = portalsPath();
  if (existsSync(destPortals) && (fields.titleKeywords?.length || fields.boardKeywords?.length || Array.isArray(fields.blocked))) {
    const current = readFileSync(destPortals, 'utf-8');
    const { text, applied: keys } = patchPortalsYaml(current, fields);
    if (keys.length && text !== current) {
      writeFileSync(destPortals, text, 'utf-8');
      patched = true;
      applied.push(...keys);
    }
  }
  return { patched, applied };
}

async function main() {
  const tty = Boolean(stdinStream.isTTY && stdoutStream.isTTY);
  const interactive = !DEFAULTS && (FORCE_INTERACTIVE || (tty && !JSON_OUT));

  if (!JSON_OUT) {
    console.log('\n채용옵스 setup');
    console.log('==============\n');
  }

  const result = copyMissing();
  if (result.missingSources.length && !JSON_OUT) {
    console.error(`예제 파일을 찾지 못했습니다: ${result.missingSources.join(', ')}`);
  }

  const flagFields = flagsFromArgv();
  let fields = {
    years: flagFields.years,
    roles: flagFields.roles,
    titleKeywords: flagFields.titleKeywords,
    boardKeywords: flagFields.boardKeywords,
    blocked: flagFields.blocked,
  };

  const destProfile = profilePath();
  if (existsSync(destProfile) && interactive) {
    const current = readFileSync(destProfile, 'utf-8');
    const shouldAskAll = result.copied.includes('config/profile.yml') || looksLikeExampleProfile(current);
    if (CONFIGURE || shouldAskAll) {
      const prompted = await promptFields({ targetingOnly: CONFIGURE && !shouldAskAll });
      fields = mergeFields(prompted, fields);
    } else if (!JSON_OUT && !flagFields.hasTargeting) {
      console.log('config/profile.yml 이 이미 채워져 있어 질문은 건너뜁니다. 직종/연차/블랙리스트만 바꾸려면 --configure');
    }
  } else if (interactive && CONFIGURE && !existsSync(destProfile) && !JSON_OUT) {
    console.log('config/profile.yml 이 없어 --configure 질문을 건너뜁니다.');
  }

  const { patched, applied } = applyPatches(fields);

  const payload = {
    copied: result.copied,
    skipped: result.skipped,
    patched,
    applied,
    root: DATA_ROOT,
    next: [
      '직종·연차·블랙리스트: node setup.mjs --configure  (또는 --years / --families / --blocked)',
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
