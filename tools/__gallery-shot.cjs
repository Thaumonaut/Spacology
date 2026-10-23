'use strict';
const { chromium } = require('playwright');
const M = require('../prototypes/labs/microvoxel-world/voxel-world-model.js');
const SHOTS = [
  { name: 'gallery-avenue', px: -2, pz: 0, ax: 90, az: 0 },
  { name: 'gallery-conifers', px: 140, pz: 0, ax: 230, az: 0 },
  { name: 'gallery-sequoia', px: -70, pz: 60, ax: -143, az: 113 },
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  for (const s of SHOTS) {
    const pos = M.positionAt(s.px, s.pz);
    const yaw = Math.atan2(-(s.ax - s.px), -(s.az - s.pz));
    await page.goto(`http://localhost:8765/prototypes/microvoxel-world.html?seed=2718&gallery=1&cx=${pos.cx}&cz=${pos.cz}&lx=${pos.x}&lz=${pos.z}&walk=1&yaw=${yaw}`);
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
