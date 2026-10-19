import { chromium } from 'playwright';
import { preview } from 'vite';

const duration = Math.max(3000, Number(process.env.SPACOLOGY_BENCHMARK_DURATION_MS) || 15000);
const gate = process.env.SPACOLOGY_BENCHMARK_GATE === '1';
const headed = process.env.SPACOLOGY_HEADED === '1';
const softwareGL = process.env.SPACOLOGY_SOFTWARE_GL === '1';
const width = Number(process.env.SPACOLOGY_BENCHMARK_WIDTH) || 1440;
const height = Number(process.env.SPACOLOGY_BENCHMARK_HEIGHT) || 900;
const dpr = Number(process.env.SPACOLOGY_BENCHMARK_DPR) || 1;
let server;
let browser;

function summarize(intervals) {
  const sorted = intervals.slice().sort((a, b) => a - b);
  const at = quantile => sorted[Math.floor((sorted.length - 1) * quantile)];
  const windows = [];
  let windowMs = 0, windowFrames = 0;
  for (const interval of intervals) {
    windowMs += interval;
    windowFrames++;
    if (windowMs >= 5000) {
      windows.push(windowFrames / (windowMs / 1000));
      windowMs = 0;
      windowFrames = 0;
    }
  }
  if (windowMs >= 2500) windows.push(windowFrames / (windowMs / 1000));
  return {
    frames: sorted.length,
    fps: Number((sorted.length / (intervals.reduce((sum, value) => sum + value, 0) / 1000)).toFixed(1)),
    p95Ms: Number(at(.95).toFixed(1)),
    p99Ms: Number(at(.99).toFixed(1)),
    maxMs: Number(sorted.at(-1).toFixed(1)),
    lowestWindowFps: Number(Math.min(...windows).toFixed(1))
  };
}

async function measure(page, name, setup) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => Boolean(window.relayRunner?.view));
  await setup(page);
  await page.waitForTimeout(2000);
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  const result = await page.evaluate(ms => new Promise(resolve => {
    let start = 0, last = 0;
    const intervals = [];
    function tick(now) {
      if (!start) start = now;
      if (last) intervals.push(now - last);
      last = now;
      if (now - start < ms) requestAnimationFrame(tick);
      else resolve({ intervals, stats: window.relayRunner.game.stats(), quality: window.relayRunner.performance.quality });
    }
    requestAnimationFrame(tick);
  }), duration);
  if (errors.length) throw new Error(`${name} page errors: ${errors.join('; ')}`);
  return { scene: name, ...summarize(result.intervals), quality: Number(result.quality.toFixed(2)), phase: result.stats.phase,
    enemies: result.stats.enemies, bullets: result.stats.bullets, renderer };
}

try {
  server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
  browser = await chromium.launch({
    headless: !headed,
    args: softwareGL ? ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] : []
  });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const latePage = await context.newPage();
  const late = await measure(latePage, 'late wave + full squad and stationary guns', async page => {
    await page.getByRole('button', { name: /start run/i }).click();
    await page.evaluate(() => {
      const game = window.relayRunner.game;
      game.wave = 28;
      game.squadSize = 60;
      game.maxSquad = 60;
      game.hitPlayer = () => {};
      game.cannonLevel = 6;
      game.shockLevel = 6;
      game.spawnWave();
      game.steer(5);
    });
  });
  if (late.phase !== 'running') throw new Error(`Late-wave scene stopped during benchmark: ${late.phase}`);
  await latePage.close();
  const stressPage = await context.newPage();
  const stress = await measure(stressPage, '2,000 enemies + 6,000 bullets', page => page.getByRole('button', { name: /run 8,000 entity load test/i }).click());
  if (stress.phase !== 'stress') throw new Error(`Load scene stopped during benchmark: ${stress.phase}`);
  await stressPage.close();
  const report = { durationSeconds: duration / 1000, headed, softwareGL, viewport: { width, height, dpr }, scenes: [late, stress] };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (gate && report.scenes.some(scene => scene.lowestWindowFps < 60 || scene.p95Ms > 16.7 || scene.p99Ms > 20)) process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
