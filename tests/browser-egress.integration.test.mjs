import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dgram from 'node:dgram';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { readJobPage } from '../lib/job-browser.mjs';
import { checkUrlLiveness, newLivenessPage, setHostResolver, rejectPrivateOrInvalid } from '../liveness-browser.mjs';
import { BROWSER_EGRESS_LAUNCH_OPTIONS, createBrowserEgress, newGuardedBrowserContext } from '../lib/browser-egress.mjs';
import { isBlockedAddress } from '../providers/_ip-guard.mjs';

const PUBLIC_IP = '93.184.216.34';
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

test('parsed IP ranges cover expanded IPv6 and the entire ULA/link-local ranges', () => {
  for (const ip of ['fd00::1', 'fdaa::1', 'febf::1', 'fe90::1', '0:0:0:0:0:0:0:1', '0:0:0:0:0:ffff:7f00:1', '::ffff:7f00:1', '::ffff:a00:1', '2002:7f00:1::1', '64:ff9b::7f00:1', 'not:an:ip']) {
    assert.ok(isBlockedAddress(ip), ip);
    if (net.isIP(ip)) assert.equal(rejectPrivateOrInvalid(`http://[${ip}]/`)?.code, 'blocked_host', ip);
  }
  assert.equal(isBlockedAddress('0:0:0:0:0:ffff:808:808'), false);
});

test('real Chromium connections enforce redirects and DNS at the dialing boundary', { timeout: 60_000 }, async () => {
  let privateHits = 0;
  const privateServer = http.createServer((_req, res) => { privateHits++; res.end('INTERNAL SECRET'); });
  privateServer.on('upgrade', (_req, socket) => { privateHits++; socket.destroy(); });
  const privatePort = await listen(privateServer);
  const seen = [], hosts = [];
  const publicServer = http.createServer((req, res) => {
    seen.push(req.url);
    hosts.push(req.headers.host);
    if (req.url === '/valid-redirect') { res.writeHead(302, { Location: `http://second.egress.test:${publicPort}/hydrated` }); return res.end(); }
    if (req.url === '/private-redirect') { res.writeHead(302, { Location: `http://127.0.0.1:${privatePort}/secret` }); return res.end(); }
    if (req.url === '/private-v6-redirect') { res.writeHead(302, { Location: `http://[::1]:${privatePort}/secret` }); return res.end(); }
    if (req.url === '/private-dns-redirect') { res.writeHead(302, { Location: `http://private.egress.test:${privatePort}/secret` }); return res.end(); }
    if (req.url === '/api') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ text: '백엔드 개발자 Python API 개발 모집 '.repeat(20), cookie: req.headers.cookie ?? '' })); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': 'fixture=yes; Path=/' });
    const image = req.url === '/subresource' ? '<img src="/private-redirect"><img src="/private-dns-redirect">' : '';
    const dead = req.url === '/dead-subresource' ? '<script src="http://dead.egress.test/widget.js"></script>' : '';
    res.end(`<!doctype html><main><h1>백엔드 개발자</h1><p id="job"></p><button>지원하기</button></main>${image}${dead}<script>fetch('/api').then(r=>r.json()).then(data=>{document.querySelector('#job').textContent=data.text+data.cookie})</script>`);
  });
  const publicPort = await listen(publicServer);
  publicServer.on('upgrade', (req, socket) => {
    const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.end(Buffer.from([0x81, 2, 79, 75]));
  });
  const sni = [];
  const tlsServer = https.createServer({
    key: readFileSync(new URL('./fixtures/browser-egress/key.pem', import.meta.url)),
    cert: readFileSync(new URL('./fixtures/browser-egress/cert.pem', import.meta.url)),
  }, (req, res) => {
    if (req.url === '/tls-redirect') { res.writeHead(302, { Location: `https://second.egress.test:${tlsPort}/tls-final` }); return res.end(); }
    if (req.url === '/tls-private-redirect') { res.writeHead(302, { Location: `http://127.0.0.1:${privatePort}/secret` }); return res.end(); }
    res.setHeader('Content-Type', 'text/html');
    res.end('<h1>HTTPS fixture</h1><button>Apply</button>');
  });
  tlsServer.on('secureConnection', socket => sni.push(socket.servername));
  const tlsPort = await listen(tlsServer);
  const connections = [], attemptedConnections = [];
  let rebindLookups = 0;
  const resolver = async host => {
    if (host === 'dual.egress.test') return ['1.1.1.1', PUBLIC_IP];
    if (host === 'private.egress.test') return ['127.0.0.1'];
    if (host === 'mixed.egress.test') return [PUBLIC_IP, 'fd00::1'];
    if (host === 'dead.egress.test') return [];
    if (host === 'rebind.egress.test') return ++rebindLookups === 1 ? [PUBLIC_IP] : ['127.0.0.1'];
    return /^(?:public|second)\.egress\.test$/.test(host) ? [PUBLIC_IP] : [];
  };
  const connector = options => {
    attemptedConnections.push(options);
    if (options.host === '1.1.1.1') {
      const failed = new net.Socket();
      queueMicrotask(() => failed.destroy(Object.assign(new Error('synthetic unreachable first public IP'), { code: 'ENETUNREACH' })));
      return failed;
    }
    assert.equal(options.host, PUBLIC_IP, 'connector receives the exact validated public literal, never a hostname');
    assert.ok([publicPort, tlsPort].includes(options.port), 'private fixture must never reach the connector');
    connections.push(options);
    return net.connect({ host: '127.0.0.1', port: options.port });
  };
  const restore = setHostResolver(resolver);
  const browser = await chromium.launch({ headless: true, ...BROWSER_EGRESS_LAUNCH_OPTIONS });
  const base = `http://public.egress.test:${publicPort}`;
  try {
    // Exercise the shared Korean/job reader, including its actual context.
    const read = path => readJobPage(base + path, { egressOptions: { connect: connector }, settleMs: 300, timeout: 4000 });
    const valid = await read('/valid-redirect');
    assert.equal(valid.liveness.result, 'active');
    assert.ok(valid.url.includes('second.egress.test'));
    assert.ok(valid.text.includes('fixture=yes'), 'hydration and browser cookies survive the tunnel');
    assert.ok(hosts.includes(`second.egress.test:${publicPort}`), 'HTTP Host remains the original hostname');
    const dual = await readJobPage(`http://dual.egress.test:${publicPort}/hydrated`, { egressOptions: { connect: connector }, settleMs: 300, timeout: 4000 });
    assert.equal(dual.liveness.result, 'active', 'unreachable first public DNS answer falls back to a healthy public answer');
    const firstAttempt = attemptedConnections.findIndex(options => options.host === '1.1.1.1');
    assert.equal(attemptedConnections[firstAttempt + 1]?.host, PUBLIC_IP);
    const subresource = await read('/subresource');
    assert.ok(subresource.text.includes('Python API'), 'legitimate hydration still completes beside blocked redirects');
    await assert.rejects(read('/private-redirect'));
    await assert.rejects(read('/private-dns-redirect'));
    await assert.rejects(readJobPage(`http://rebind.egress.test:${publicPort}/rebind`, { egressOptions: { connect: connector }, timeout: 4000 }));
    assert.ok(rebindLookups >= 2, 'DNS changes after preflight and is revalidated before dialing');
    assert.ok(!seen.includes('/rebind'), 'DNS rebind never reaches even the fixture connector');
    assert.equal(privateHits, 0, 'private redirect targets were never contacted');

    // Check the connection boundary without routing hooks: Chromium redirects
    // bypass route validation, but must still traverse the enforced proxy.
    const egress = await createBrowserEgress({ resolveHost: resolver, connect: connector });
    const context = await browser.newContext({ proxy: egress.proxy, serviceWorkers: 'block', ignoreHTTPSErrors: true });
    try {
      for (const target of [base + '/private-redirect', base + '/private-dns-redirect', `http://mixed.egress.test:${publicPort}/mixed`]) {
        const failed = await context.newPage();
        await assert.rejects(failed.goto(target, { timeout: 4000 }));
        await failed.close();
      }
      const page = await context.newPage();
      await page.goto(base + '/subresource');
      await page.waitForTimeout(300);
      assert.equal(privateHits, 0, 'proxy blocks both literal and DNS private redirects without route hooks');

      const tls = await context.newPage();
      await tls.goto(`https://public.egress.test:${tlsPort}/tls-redirect`);
      assert.ok(tls.url().includes('second.egress.test'));
      assert.equal(await tls.locator('h1').innerText(), 'HTTPS fixture');
      assert.ok(sni.includes('public.egress.test') && sni.includes('second.egress.test'), 'TLS passes through with original SNI');
      await tls.close();
      const tlsPrivate = await context.newPage();
      await assert.rejects(tlsPrivate.goto(`https://public.egress.test:${tlsPort}/tls-private-redirect`, { timeout: 4000 }));
      await tlsPrivate.close();
      assert.equal(privateHits, 0, 'HTTPS-origin redirect never contacts the private target');

      const workerFetch = url => page.evaluate(target => new Promise(resolve => {
        const worker = new Worker(URL.createObjectURL(new Blob([`onmessage=async event=>{try{const response=await fetch(event.data);postMessage({ok:true,text:await response.text()})}catch{postMessage({ok:false})}}`], { type: 'text/javascript' })));
        worker.onmessage = event => { worker.terminate(); resolve(event.data); };
        worker.postMessage(target);
      }), url);
      assert.equal((await workerFetch(base + '/api')).ok, true, 'public worker fetch works');
      egress.clearFailures();
      assert.equal((await workerFetch(base + '/private-redirect')).ok, false);
      assert.ok(egress.failures.has('127.0.0.1'), 'worker redirect reaches and is denied by the proxy');

      const websocket = url => page.evaluate(target => new Promise(resolve => {
        const socket = new WebSocket(target);
        socket.onmessage = event => { resolve(event.data); socket.close(); };
        socket.onerror = () => resolve('blocked');
      }), url);
      assert.equal(await websocket(`ws://public.egress.test:${publicPort}/socket`), 'OK', 'public WebSocket works');
      egress.clearFailures();
      assert.equal(await websocket(`ws://127.0.0.1:${privatePort}/socket`), 'blocked');
      assert.ok(egress.failures.has('127.0.0.1'), 'WebSocket loopback reaches and is denied by the proxy');

      const popupPromise = context.waitForEvent('page');
      await page.evaluate(() => window.open('/hydrated'));
      const popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded');
      assert.ok(popup.url().endsWith('/hydrated'), 'public popup navigation works');
      await popup.close();
      egress.clearFailures();
      const blockedPopupPromise = context.waitForEvent('page');
      await page.evaluate(() => window.open('/private-redirect'));
      const blockedPopup = await blockedPopupPromise;
      await page.waitForTimeout(300);
      assert.ok(egress.failures.has('127.0.0.1'), 'popup redirect reaches and is denied by the proxy');
      await blockedPopup.close();
      assert.equal(privateHits, 0, 'worker, WebSocket and popup never contact the private server');
    } finally { await context.close(); await egress.close(); }

    const livenessPage = await newLivenessPage(browser, { egressOptions: { connect: connector } });
    try {
      assert.equal((await checkUrlLiveness(livenessPage, base + '/dead-subresource')).result, 'active');
      assert.equal((await checkUrlLiveness(livenessPage, 'http://dead.egress.test/job')).code, 'blocked_host');
      assert.equal((await checkUrlLiveness(livenessPage, base + '/private-redirect')).code, 'blocked_host');
      // A fresh page avoids Chromium's deferred error-page navigation race.
      const ipv6Page = await livenessPage.context().newPage();
      assert.equal((await checkUrlLiveness(ipv6Page, base + '/private-v6-redirect')).code, 'blocked_host');
    } finally { await livenessPage.context().close(); }
    const unguarded = await browser.newContext();
    try {
      const result = await checkUrlLiveness(await unguarded.newPage(), base + '/hydrated');
      assert.equal(result.code, 'blocked_host');
      assert.match(result.reason, /no enforced egress proxy/);
    } finally { await unguarded.close(); }
    assert.ok(connections.length > 0, 'positive control made real tunneled connections');
    assert.ok(attemptedConnections.every(options => [PUBLIC_IP, '1.1.1.1'].includes(options.host) && [publicPort, tlsPort].includes(options.port)), 'no blocked address ever reached the connector');
  } finally {
    await browser.close(); restore();
    await close(publicServer); await close(privateServer); await close(tlsServer);
  }
});

test('guarded factory verifies browser flags and WebRTC cannot send direct STUN UDP', { timeout: 20_000 }, async () => {
  const udp = dgram.createSocket('udp4');
  await new Promise(resolve => udp.bind(0, '127.0.0.1', resolve));
  const port = udp.address().port;
  let packets = 0;
  udp.on('message', () => { packets++; });
  const protectedBrowser = await chromium.launch({ headless: true, ...BROWSER_EGRESS_LAUNCH_OPTIONS });
  const unsafeBrowser = await chromium.launch({ headless: true, args: ['--enable-automation'] });
  const fixturePage = async context => {
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<h1>Local STUN fixture</h1>' }));
    const page = await context.newPage();
    await page.goto('http://stun.egress.test/');
    return page;
  };
  const stun = page => page.evaluate(async stunPort => {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: `stun:127.0.0.1:${stunPort}` }] });
    peer.createDataChannel('probe');
    await peer.setLocalDescription(await peer.createOffer());
    await new Promise(resolve => setTimeout(resolve, 650));
    peer.close();
  }, port);
  try {
    await assert.rejects(newGuardedBrowserContext(unsafeBrowser), /must disable QUIC and non-proxied WebRTC UDP/);
    assert.equal(unsafeBrowser.contexts().length, 0, 'unsafe browser is rejected before context creation');
    const protectedContext = await newGuardedBrowserContext(protectedBrowser);
    try { await stun(await fixturePage(protectedContext)); }
    finally { await protectedContext.close(); }
    assert.equal(packets, 0, 'guarded Chromium sends no UDP packets to loopback STUN');
    const unsafeContext = await unsafeBrowser.newContext();
    try { await stun(await fixturePage(unsafeContext)); }
    finally { await unsafeContext.close(); }
    assert.ok(packets > 0, 'unprotected Chromium control sends real UDP, proving the detector works');
  } finally {
    await protectedBrowser.close(); await unsafeBrowser.close();
    await new Promise(resolve => udp.close(resolve));
  }
});

test('guard context tears down its listener after context, route and page failures', async () => {
  for (const failure of ['context', 'route', 'page']) {
    let proxyPort, closed = 0;
    const browser = { newContext: async options => {
      proxyPort = Number(new URL(options.proxy.server).port);
      if (failure === 'context') throw new Error('synthetic context failure');
      return {
        close: async () => { closed++; },
        route: async () => { if (failure === 'route') throw new Error('synthetic route failure'); },
        newPage: async () => { throw new Error('synthetic page failure'); },
      };
    } };
    await assert.rejects(failure === 'page' ? newLivenessPage(browser) : newGuardedBrowserContext(browser), /synthetic/);
    assert.equal(closed, failure === 'context' ? 0 : 1);
    await assert.rejects(new Promise((resolve, reject) => {
      const socket = net.connect({ host: '127.0.0.1', port: proxyPort });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', reject);
    }), { code: 'ECONNREFUSED' }, 'the proxy listener closes on construction failures');
  }
});

test('closing the egress proxy cancels an unfinished dial without leaving a timeout alive', async () => {
  const moduleUrl = new URL('../lib/browser-egress.mjs', import.meta.url).href;
  const code = `
    import net from 'node:net';
    import { createBrowserEgress } from ${JSON.stringify(moduleUrl)};
    let started;
    const dialing = new Promise(resolve => { started = resolve; });
    const egress = await createBrowserEgress({ resolveHost: async () => ['${PUBLIC_IP}'], connect: () => { started(); return new net.Socket(); } });
    const client = net.connect({ host: '127.0.0.1', port: Number(new URL(egress.proxy.server).port) });
    client.on('error', () => {});
    client.once('connect', () => client.write(Buffer.concat([Buffer.from([5, 1, 0, 5, 1, 0, 3, 18]), Buffer.from('public.egress.test'), Buffer.from([0, 80])])));
    await dialing;
    await egress.close();
  `;
  // A leaked pending-dial timeout keeps this child alive for ten seconds.
  // Successful teardown must let the process exit by itself within the budget.
  await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], { timeout: 2000 });
});
