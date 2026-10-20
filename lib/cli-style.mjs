export function cliStyle(stream = process.stdout, env = process.env) {
  const enabled = Boolean(stream.isTTY) && !('NO_COLOR' in env) && env.TERM !== 'dumb';
  const paint = code => value => enabled ? `\x1b[${code}m${value}\x1b[0m` : String(value);
  return { title: paint(36), success: paint(32), warning: paint(33), error: paint(31), path: paint(2) };
}
