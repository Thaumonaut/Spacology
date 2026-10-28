'use strict';
const { chromium } = require('playwright');
const M = require('../prototypes/labs/microvoxel-world/voxel-world-model.js');
const SHOTS = [
  { name: 'conifer-tiers', seed: 203749, px: -2350, pz: 700, ax: -2500, az: 1100 },
  { name: 'volcano-view', seed: 203749, px: -8930, pz: -3823, ax: -8150, az: 100 },
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  for (const s of SHOTS) {
    const pos = M.positionAt(s.px, s.pz);
    const yaw = Math.atan2(-(s.ax - s.px), -(s.az - s.pz));
    await page.goto(`http://localhost:8765/prototypes/microvoxel-world.html?seed=${s.seed||2718}&cx=${pos.cx}&cz=${pos.cz}&lx=${pos.x}&lz=${pos.z}&walk=1&yaw=${yaw}`);
    try {
      await page.waitForFunction(() => {
        const s = window.MicroWorldLab && window.MicroWorldLab.snapshot();
        return s && !s.failed && s.ready > 0 && s.ready === s.visible && !s.pending;
      }, null, { timeout: 150000 });
    } catch (e) { console.log('ready-timeout', s.name); }
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `/tmp/${s.name}.png`, timeout: 120000 });
    console.log('shot', s.name);
  }
  await browser.close();
})().catch(e => { console.log('ERR', e); process.exit(1); });
