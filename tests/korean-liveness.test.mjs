import assert from 'node:assert/strict';
import { pass } from './helpers.mjs';
import { classifyLiveness } from '../liveness-core.mjs';
const check = (text, controls = []) => classifyLiveness({status: 200, requestedUrl: 'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=12345', finalUrl: 'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=12345', bodyText: text, applyControls: controls});
for (const label of ['지원하기', '입사지원', '온라인 입사지원', '홈페이지 지원', '기업 사이트에서 지원하기', '지원하기'.normalize('NFD')]) {
  assert.equal(check('백엔드 개발자 모집 '.repeat(40), [label]).result, 'active', label);
}
for (const text of ['본 채용공고는 마감되었습니다', '접수가 마감된 공고입니다', '채용이 종료되었습니다']) {
  assert.equal(check(text, ['지원하기']).result, 'expired', text);
}
for (const text of ['로그인이 필요합니다', '보안 확인을 완료해 주세요', '페이지를 불러오는 중입니다']) {
  assert.equal(check(text).result, 'uncertain', text);
}
assert.equal(check('백엔드 개발자 모집. 채용시 마감. 마감일 2026-12-31', ['지원하기']).result, 'active');
pass('Korean controls, NFC/NFD, closure, login, security and loading verdicts');
