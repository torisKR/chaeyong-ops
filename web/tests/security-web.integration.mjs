// Real Next listener and synthetic files only. No model, credentials or user CV.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir, networkInterfaces } from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const web = fileURLToPath(new URL("../", import.meta.url));
const root = mkdtempSync(path.join(process.env.CAREER_OPS_TEST_ARTIFACTS || tmpdir(), "web-security-"));
mkdirSync(path.join(root, "data"));
writeFileSync(path.join(root, "cv.md"), "# Synthetic private CV\n");
writeFileSync(path.join(root, "data", "applications.md"), "# Applications\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|------|---------|------|-------|--------|-----|--------|-------|\n");
const reservation = net.createServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
let session, output = "";
const mode = process.argv[2] || "dev";
const child = spawn(process.execPath, ["scripts/local-server.mjs", mode, "--port", String(port)], {
  cwd: web, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", CAREER_OPS_ROOT: root, CAREER_OPS_DATA_DIR: root },
});
child.stdout.on("data", bytes => {
  output += bytes;
  session ||= output.match(/\/_session\?token=([a-f0-9]{64})/)?.[1];
});
child.stderr.on("data", bytes => { output += bytes; });
// Use the raw HTTP client: fetch may discard a supplied Host header.
const request = (pathname, options = {}) => new Promise((resolve, reject) => {
  const req = http.request(base + pathname, { method: options.method || "GET", headers: options.headers, timeout: 30_000 }, res => {
    const chunks = [];
    res.on("data", data => chunks.push(data));
    res.on("end", () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
  });
  req.on("error", reject); req.on("timeout", () => req.destroy(new Error("request timeout")));
  req.end(options.body);
});
try {
  for (let n = 0; ; n++) {
    if (child.exitCode !== null) throw new Error("Next exited before ready");
    try { await request("/api/cv"); break; } catch { if (n > 100) throw new Error("Next readiness timeout"); }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(session, "launcher supplies a fresh session URL");
  for (const pathname of ["/api/cv", "/pipeline", "/pipeline/1", "/cv", "/config"]) {
    const response = await request(pathname, { headers: { Host: `localhost:${port}` } });
    assert.equal(response.status, 401, `${pathname}: spoofed Host cannot authenticate`);
    assert.equal((await response.text()).includes("Synthetic private CV"), false);
  }
  assert.equal((await request("/_session?token=" + "b".repeat(64), { redirect: "manual" })).status, 401);
  const bootstrap = await request("/_session?token=" + session, { redirect: "manual" });
  assert.equal(bootstrap.status, 303, output.replaceAll(session, "[session]"));
  assert.equal(new URL(bootstrap.headers.get("location"), base).pathname, "/");
  assert.equal(bootstrap.headers.get("cache-control"), "no-store");
  const setCookie = bootstrap.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=strict/i);
  const cookie = setCookie.split(";")[0];
  const authorized = await request("/api/cv", { headers: { Cookie: cookie } });
  assert.equal(authorized.status, 200);
  assert.equal((await authorized.json()).content, "# Synthetic private CV\n");
  assert.equal((await request("/pipeline", { headers: { Cookie: cookie } })).status, 200, "authorized SSR page works");
  assert.equal((await request("/api/cv", { headers: { Authorization: `Bearer ${session}` } })).status, 200, "local CLI bearer client works");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(base + "/_session?token=" + session);
    assert.equal(new URL(page.url()).pathname, "/", "browser session link removes the token from the address bar");
    const result = await page.evaluate(async () => {
      const response = await fetch("/api/cv");
      return { status: response.status, body: await response.json() };
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.content, "# Synthetic private CV\n");
    assert.equal((await page.goto(base + "/pipeline")).status(), 200);
  } finally { await browser.close(); }
  for (const headers of [
    { Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site" },
    { Host: `attacker.invalid:${port}` },
    { Origin: "null" },
  ]) {
    const response = await request("/api/cv", { method: "POST", headers: { ...headers, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ content: "malicious" }) });
    assert.equal(response.status, 403, `rejected headers: ${Object.keys(headers).join(", ")}`);
    assert.equal(readFileSync(path.join(root, "cv.md"), "utf8"), "# Synthetic private CV\n");
  }
  let lanChecks = 0;
  for (const info of Object.values(networkInterfaces()).flat()) {
    if (info.internal || info.family !== "IPv4") continue;
    await assert.rejects(fetch(`http://${info.address}:${port}/api/cv`, { headers: { Host: `localhost:${port}` }, signal: AbortSignal.timeout(2000) }));
    lanChecks++;
  }
  console.log(`Web security integration (${mode}) passed: unauthenticated SSR/API denied, Chromium session and local CLI allowed, CSRF writes denied, LAN listener checks=${lanChecks}`);
} finally {
  child.kill("SIGTERM");
  await new Promise(resolve => child.exitCode !== null || child.signalCode !== null ? resolve() : child.once("exit", resolve));
  rmSync(root, { recursive: true, force: true });
}
