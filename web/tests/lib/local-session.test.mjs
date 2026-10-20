import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validSessionSecret, matchesSession, sessionAuthorized } from "../../src/lib/local-session.mjs";
import { localServerArgs } from "../../scripts/local-server.mjs";

const secret = "a".repeat(64);
test("a forged localhost Host cannot replace possession of a session", () => {
  for (const candidate of [undefined, null, "", "localhost", "a".repeat(63), "b".repeat(64)]) {
    assert.equal(sessionAuthorized({ cookie: candidate, authorization: null, secret }), false);
  }
  assert.equal(sessionAuthorized({ cookie: secret, secret }), true);
  assert.equal(sessionAuthorized({ authorization: `Bearer ${secret}`, secret }), true);
  assert.equal(sessionAuthorized({ authorization: secret, secret }), false);
});
test("missing, malformed and previous-launch session keys fail closed", () => {
  for (const value of [undefined, "", "placeholder", "x".repeat(64)]) {
    assert.equal(validSessionSecret(value), false);
    assert.equal(matchesSession(value, value), false);
  }
  assert.equal(matchesSession(secret, "b".repeat(64)), false);
});
test("both launch modes force literal loopback regardless of HOSTNAME env", () => {
  for (const mode of ["dev", "start"]) {
    assert.deepEqual(localServerArgs(mode, [], { HOSTNAME: "0.0.0.0" }), {
      args: [mode, "--hostname", "127.0.0.1", "--port", "3000"], port: 3000,
    });
    assert.equal(localServerArgs(mode, ["--port", "4321"], {}).port, 4321);
    for (const args of [["-H", "0.0.0.0"], ["--hostname=0.0.0.0"], ["-H0.0.0.0"]]) {
      assert.throws(() => localServerArgs(mode, args, {}), /hostname overrides/);
    }
  }
  for (const port of ["0", "-1", "65536", "bad"]) assert.throws(() => localServerArgs("dev", [], { PORT: port }), /port/);
});
test("HTTPS launch options produce an HTTPS session link", () => {
  const result = spawnSync(process.execPath, ["scripts/local-server.mjs", "dev", "--experimental-https", "--help"], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)), encoding: "utf8", timeout: 10_000,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /https:\/\/127\.0\.0\.1:3000\/_session\?token=[a-f0-9]{64}/);
});
