import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { isMainModule } from "../../lib/is-main-module.mjs";

export function localServerArgs(mode, args, env = process.env) {
  if (!["dev", "start"].includes(mode)) throw new Error("Expected dev or start");
  // Never let npm's forwarded flags override the literal loopback binding.
  if (args.some(a => a === "-H" || a.startsWith("-H") || a === "--hostname" || a.startsWith("--hostname="))) {
    throw new Error("The private dashboard binds to 127.0.0.1; hostname overrides are disabled");
  }
  const flag = args.findIndex(a => a === "-p" || a === "--port");
  const equals = args.find(a => a.startsWith("--port="));
  const portText = flag >= 0 ? args[flag + 1] : equals?.slice(7) ?? env.PORT ?? "3000";
  if (!/^\d+$/.test(String(portText)) || Number(portText) < 1 || Number(portText) > 65535) {
    throw new Error("Expected a port between 1 and 65535");
  }
  return { args: [mode, ...args, "--hostname", "127.0.0.1", "--port", String(Number(portText))], port: Number(portText) };
}

export function main() {
  const { args, port } = localServerArgs(process.argv[2], process.argv.slice(3));
  const secret = randomBytes(32).toString("hex");
  const require = createRequire(import.meta.url);
  const scheme = args.includes("--experimental-https") ? "https" : "http";
  console.log(`Private dashboard session (open after Ready): ${scheme}://127.0.0.1:${port}/_session?token=${secret}`);
  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), ...args], {
    stdio: "inherit",
    env: { ...process.env, CAREER_OPS_WEB_SESSION: secret },
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", err => { console.error(err.message); process.exitCode = 1; });
  child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}

if (isMainModule(import.meta.url)) {
  try { main(); } catch (err) { console.error(err.message); process.exitCode = 1; }
}
