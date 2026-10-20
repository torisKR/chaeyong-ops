#!/usr/bin/env node
// Public read-only verification. No credentials, form entry or submissions.
import fs from 'node:fs';
import path from 'node:path';
import { getCareerOpsRoot } from '../path-resolver.mjs';
import { readJobPage } from '../lib/job-browser.mjs';
import { buildJobkoreaSearchUrl } from '../providers/jobkorea.mjs';
import { buildSaraminSearchUrl } from '../providers/saramin.mjs';
import wanted from '../providers/wanted.mjs';
import { makeHttpCtx } from '../providers/_http.mjs';
const dir = path.join(getCareerOpsRoot(), 'output', 'korean-portals-verification');
fs.mkdirSync(dir, { recursive: true });
const requested = process.argv.slice(2);
if (requested.some(id => !['jobkorea','saramin','wanted'].includes(id))) throw new Error('Expected portal name jobkorea|saramin|wanted');
const results = new Map();
for (const id of ['jobkorea','saramin','wanted']) {
  try { results.set(id, JSON.parse(fs.readFileSync(path.join(dir, `${id}-verification.json`),'utf8'))); } catch {}
}
for (const [id, listUrl] of [
  ['jobkorea', buildJobkoreaSearchUrl('백엔드', 1)],
  ['saramin', buildSaraminSearchUrl('백엔드', 1)],
  ['wanted', 'https://www.wanted.co.kr/wdlist/518?country=kr&job_sort=job.latest_order'],
]) {
  if (requested.length && !requested.includes(id)) continue;
  const row = { portal: id, listUrl, observedAt: new Date().toISOString(), status: 'incomplete' };
  try {
    const listing = await readJobPage(listUrl, { listing: id === 'wanted' ? undefined : id, screenshot: path.join(dir, `${id}-list.png`) });
    row.list = { url: listing.url, status: listing.status, liveness: listing.liveness, screenshot: listing.screenshotError ? null : `${id}-list.png`, ...(listing.screenshotError ? {screenshotError:listing.screenshotError}: {}) };
    let jobs = listing.jobs;
    if (id === 'wanted') jobs = await wanted.fetch({ max_pages: 1, searchKeywords: '백엔드' }, makeHttpCtx());
    row.list.count = jobs.length;
    fs.writeFileSync(path.join(dir, `${id}-list.json`), JSON.stringify(jobs, null, 2));
    if (jobs.length) {
      const detail = await readJobPage(jobs[0].url, { screenshot: path.join(dir, `${id}-detail.png`) });
      row.detail = { url: detail.url, requestedUrl: jobs[0].url, title: detail.title, status: detail.status, textLength: detail.text.length, liveness: detail.liveness, screenshot: detail.screenshotError ? null : `${id}-detail.png`, observedAt: detail.observedAt };
      fs.writeFileSync(path.join(dir, `${id}-detail.txt`), detail.text);
      if (detail.liveness.result === 'active') row.status = 'verified';
    }
  } catch (err) { row.error = String(err.message).split('\n')[0]; }
  results.set(id, row);
  fs.writeFileSync(path.join(dir, `${id}-verification.json`), JSON.stringify(row,null,2));
  fs.writeFileSync(path.join(dir, 'verification.json'), JSON.stringify([...results.values()], null, 2));
  console.log(`${id}: ${row.status}${row.error ? ` (${row.error})` : ''}`);
}
console.log(`Evidence: ${dir}`);
