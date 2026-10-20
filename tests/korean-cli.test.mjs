import assert from 'node:assert/strict';
import { pass } from './helpers.mjs';
import { cliStyle } from '../lib/cli-style.mjs';
import { parseEvaluation, assertPayloadSources } from '../lib/application-prep.mjs';
const summary = value => `## Machine Summary\n\n\`\`\`yaml\ncompany: 가상회사\nrole: 백엔드 개발자\nscore: ${value}\nlegitimacy_tier: Proceed with Caution\nfinal_decision: Consider\n\`\`\``;
assert.equal(parseEvaluation(summary('4.2')).company, '가상회사');
for (const score of ['8', '-1', 'NaN', '"4/5"', 'null']) assert.throws(() => parseEvaluation(summary(score)), /score/);
assert.throws(() => parseEvaluation('score: 4.2'), /Machine Summary/);
assert.throws(() => parseEvaluation(summary(4).replace('가상회사', '[]')), /company/);
for (const env of [{ NO_COLOR: '' }, { TERM: 'dumb' }]) assert.equal(cliStyle({isTTY: true}, env).title('공고'), '공고');
assert.equal(cliStyle({isTTY: false}, {}).success('완료'), '완료');
assert.match(cliStyle({isTTY: true}, {}).title('공고'), /\x1b\[36m/);
pass('Machine Summary schema and TTY/NO_COLOR/TERM color contract');
const base = {candidate: {name:'가상 지원자'}, experience:[{company:'가상회사',role:'백엔드 개발자'}]};
const sources = '가상 지원자 가상회사 백엔드 개발자 Python';
assertPayloadSources(base, 'Python 개발 경험', sources);
for (const payload of [
  {...base,candidate:{name:'다른 사람'}},
  {...base,experience:[{company:'네이버',role:'CTO'}]},
  {...base,education:[{title:'박사',org:'서울대학교'}]},
  {...base,summary:'개발팀 200명 관리'},
]) assert.throws(() => assertPayloadSources(payload, '답변', sources), /Fact check failed/);
pass('Unsupported Korean named facts and quantitative claims fail closed');
