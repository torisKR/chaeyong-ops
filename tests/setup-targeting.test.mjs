// tests/setup-targeting.test.mjs — 직종 / 연차 / 블랙리스트 config writers
import { pass, fail } from './helpers.mjs';
import {
  JOB_FAMILIES,
  parseBlockedCompanies,
  parseExperienceChoice,
  parseJobFamilies,
  parseYears,
  patchPortalsYaml,
  patchProfileYaml,
  targetingFromFamilies,
} from '../lib/setup-targeting.mjs';

console.log('\nsetup targeting — job family, years, blocked companies');

try {
  const fams = parseJobFamilies('1,3,frontend');
  if (fams.map((f) => f.id).join(',') === 'backend,frontend') {
    pass('parseJobFamilies accepts numbers, ids, and Korean labels (deduped)');
  } else fail(`families = ${fams.map((f) => f.id).join(',')}`);

  if (JOB_FAMILIES.length === 7 && JOB_FAMILIES.at(-1).id === 'other') {
    pass('preset families include 백엔드…DevOps plus 기타');
  } else fail(`JOB_FAMILIES length ${JOB_FAMILIES.length}`);

  const interactiveNew = parseExperienceChoice('1', { cli: false });
  const cliOne = parseExperienceChoice('1', { cli: true });
  const band = parseExperienceChoice('1-3', { cli: true });
  const numeric = parseExperienceChoice('1.7', { cli: false });
  if (interactiveNew?.years === 0 && interactiveNew.source === 'band'
      && cliOne?.years === 1 && cliOne.source === 'numeric'
      && band?.years === 2 && numeric?.years === 1.7) {
    pass('experience: interactive 1 = 신입 band; CLI --years 1 = 1.0; 1-3 and 1.7 work');
  } else {
    fail(`years parse: ${JSON.stringify({ interactiveNew, cliOne, band, numeric })}`);
  }

  if (parseYears('신입') === 0 && parseYears('5+') === 5) {
    pass('parseYears maps 신입 / 5+ band aliases');
  } else fail('band aliases via parseYears');

  const blocked = parseBlockedCompanies('ExampleCorp, Example Agency\nExampleCorp\nhr@example.com');
  if (blocked.join('|') === 'ExampleCorp|Example Agency') {
    pass('parseBlockedCompanies splits comma/newline, dedupes, drops emails');
  } else fail(`blocked = ${JSON.stringify(blocked)}`);

  const targeting = targetingFromFamilies(parseJobFamilies('frontend'), null);
  if (targeting.roles.includes('프론트엔드 개발자') && targeting.boardKeywords.includes('프론트엔드')) {
    pass('targetingFromFamilies maps frontend → roles + Wanted keywords');
  } else fail(`targeting = ${JSON.stringify(targeting)}`);

  const profileSrc = [
    'candidate:',
    '  full_name: "김예시"',
    '  email: "you.example@example.com"',
    'target_roles:',
    '  # comment',
    '  primary:',
    '    - "풀스택 개발자"',
    '    - "백엔드 개발자"',
    'experience:',
    '  years: 1.7   # note',
    'language:',
    '  output: ko',
    '  modes_dir: modes/ko',
  ].join('\n') + '\n';
  const patched = patchProfileYaml(profileSrc, {
    years: 4,
    roles: ['프론트엔드 개발자'],
    full_name: '테스트유저',
  });
  if (patched.applied.includes('experience.years') && patched.applied.includes('target_roles.primary')
      && /years:\s*4/.test(patched.text) && patched.text.includes('프론트엔드 개발자')
      && patched.text.includes('# comment') && !patched.text.includes('풀스택 개발자')) {
    pass('patchProfileYaml writes years + primary roles and keeps comments');
  } else fail(`profile patch: applied=${patched.applied} text=\n${patched.text}`);

  const portalsSrc = [
    'title_filter:',
    '  positive:',
    '    - "백엔드"',
    '    - "풀스택"',
    '  negative:',
    '    - "인턴"',
    'blocked_companies:',
    '  - ExampleCorp',
    '  - "Example Agency"',
    'job_boards:',
    '  - name: Wanted — 백엔드',
    '    provider: wanted',
    '    searchKeywords: "백엔드"',
    '    enabled: true',
    '  - name: Wanted — 풀스택',
    '    provider: wanted',
    '    searchKeywords: "풀스택"',
    '    enabled: true',
    '  # ── 사람인 (HTML 검색) ───────────────────────────────────────',
    '  - name: Saramin — 백엔드',
    '    provider: saramin',
    '    searchKeywords: "백엔드"',
    '    enabled: false',
  ].join('\n') + '\n';
  const portals = patchPortalsYaml(portalsSrc, {
    titleKeywords: targeting.titleKeywords,
    boardKeywords: targeting.boardKeywords,
    blocked: ['ExampleCorp'],
  });
  if (!portals.applied.includes('title_filter.positive')
      || !portals.applied.includes('job_boards.wanted')
      || !portals.applied.includes('blocked_companies')) {
    fail(`portals applied=${JSON.stringify(portals.applied)}\n${portals.text}`);
  } else if (!portals.text.includes('프론트엔드') || portals.text.includes('Example Agency')) {
    fail(`portals body missing frontend or leftover agency:\n${portals.text}`);
  } else if (!/searchKeywords: "백엔드"\n    enabled: false/.test(portals.text)
      && !/searchKeywords: "백엔드"[\s\S]*?enabled: false/.test(portals.text)) {
    fail(`Wanted 백엔드 should disable when frontend-only:\n${portals.text}`);
  } else if (!/Wanted — 프론트엔드/.test(portals.text) || !/provider: saramin[\s\S]*enabled: false/.test(portals.text)) {
    fail(`should add Wanted 프론트엔드 and leave Saramin off:\n${portals.text}`);
  } else {
    pass('patchPortalsYaml syncs title_filter, Wanted boards, blocked_companies (Saramin stays off)');
  }
} catch (e) {
  fail(`setup-targeting tests crashed: ${e.message}`);
}
