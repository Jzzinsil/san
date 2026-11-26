// node tools/check-analytics-live.mjs [base…]
// 배포 뒤(그리고 언제든) 두 운영 주소에서 방문 집계(GA4 · Vercel Web Analytics)가 실제로 나가는지 확인한다.
// 집계 요청은 보내기 직전에 브라우저 안에서 막는다 — 시험 방문이 통계에 섞이지 않는다. 스크립트 파일(gtag.js, insights/script.js)은 그대로 받는다.
// 기본 대상: https://sanissan.vercel.app/ 와 https://jzzinsil.github.io/san/ 의 한국어 · 영어 · 일본어 입구. 필요한 것: Chrome, Node 22 이상.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const bases = process.argv.slice(2).length ? process.argv.slice(2) : ['https://sanissan.vercel.app/', 'https://jzzinsil.github.io/san/'];
const pages = bases.flatMap(b => ['', 'en/', 'ja/'].map(p => b.replace(/\/?$/, '/') + p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 집계를 실제로 보내는 요청(막을 것) — GA4 수집, 구글 보조 수집, Vercel 방문 기록
const HIT = [/google-analytics\.com\/.*collect/i, /analytics\.google\.com\/.*collect/i, /doubleclick\.net/i, /google\.com\/ccm\//i, /\/_vercel\/insights\/(?!script\.js)/i, /\/va\/(?!script)/i];

const dir = mkdtempSync(join(tmpdir(), 'san-ga-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let bad = 0;
try {
  let port = 0; for (let i = 0; i < 150 && !port; i++) { try { port = +readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} if (!port) await sleep(100); }
  let wsUrl; for (let i = 0; i < 80 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!wsUrl) await sleep(150); }
  const ws = new WebSocket(wsUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); let seen = [];
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    if (m.method === 'Fetch.requestPaused') {
      const url = m.params.request.url;
      if (HIT.some(re => re.test(url))) { seen.push(url.split('?')[0]); send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' }); }
      else send('Fetch.continueRequest', { requestId: m.params.requestId });
    }
  };
  // 실제 방문자처럼 보이게: Vercel 스크립트는 자동화 브라우저(navigator.webdriver · 'Headless' 사용자 에이전트)를 일부러 세지 않는다
  const ua = (await send('Browser.getVersion')).result.userAgent.replace('HeadlessChrome', 'Chrome');
  await send('Emulation.setUserAgentOverride', { userAgent: ua });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });" });
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Runtime.enable');
  for (const url of pages) {
    seen = [];
    await send('Page.navigate', { url: url + '?check=' + Date.now() });
    await sleep(7000);
    const r = await send('Runtime.evaluate', { returnByValue: true, expression: `({ga: !!document.querySelector('script[src*="googletagmanager.com/gtag/js?id=G-L7QPQ5GGL7"]'), vercel: !!document.querySelector('script[src*="/_vercel/insights/script.js"]'), lang: document.documentElement.lang, ver: (document.body.innerText.match(/SAN v[0-9.]+/) || [''])[0]})` });
    const v = r.result.result.value || {};
    const gaHit = seen.some(u => /collect|doubleclick|ccm/i.test(u)), vcHit = seen.some(u => /_vercel\/insights/.test(u)), onVercel = /\.vercel\.app\//.test(url);
    const ok = v.ga && gaHit && (onVercel ? (v.vercel && vcHit) : true);
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${url}  [${v.lang} ${v.ver}]  GA 스크립트 ${v.ga ? '있음' : '없음'} · GA 집계 요청 ${gaHit ? '나감' : '안 나감'}` + (onVercel ? ` · Vercel 스크립트 ${v.vercel ? '있음' : '없음'} · Vercel 집계 요청 ${vcHit ? '나감' : '안 나감'}` : ''));
  }
  ws.close();
} finally {
  chrome.kill(); await sleep(500); try { rmSync(dir, { recursive: true, force: true }); } catch {}
}
console.log(bad ? `ANALYTICS FAIL (${bad})` : 'ANALYTICS OK — 두 운영 주소의 세 입구 모두 집계 요청이 나갑니다(시험 요청은 막아서 통계에 섞이지 않음)');
process.exit(bad ? 1 : 0);
