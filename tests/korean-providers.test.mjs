import assert from 'node:assert/strict';
import { pass } from './helpers.mjs';
import jobkorea from '../providers/jobkorea.mjs';
import saramin from '../providers/saramin.mjs';
for (const provider of [jobkorea, saramin]) {
  let calls = 0;
  const jobs = [{id:'12345',company:'가상회사',title:'백엔드 개발자',location:'서울',url:'https://example.com/jobs/12345'}];
  const ctx = {fetchText:()=>{throw new Error('must use browser')},sleep:async()=>{},readJobPage:async()=>{calls++;return {jobs,liveness:{result:'uncertain',code:'unverified_content'}}}};
  assert.equal((await provider.fetch({max_pages:5},ctx)).length,1);
  assert.equal(calls,2,'stop at repeated page');
  await assert.rejects(provider.fetch({max_pages:1},{...ctx,readJobPage:async()=>({jobs:[],liveness:{code:'access_blocked',reason:'403'}})}),/unable to verify/);
  await assert.rejects(provider.fetch({max_pages:1},{...ctx,readJobPage:async()=>({jobs:[],liveness:{code:'unverified_content'}})}),/no parseable postings/);
}
pass('Korean providers use rendered cards, stop stuck pagination and retain blocked/empty runs as errors');
