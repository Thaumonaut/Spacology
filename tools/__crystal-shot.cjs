'use strict';
const { chromium } = require('playwright');
const M = require('/Users/jek/Documents/Personal/Projects/Spacology/Spacology/prototypes/labs/microvoxel-world/voxel-world-model.js');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  const dist = +(process.env.SHOT_DIST || 15);
  const px = 196.55 - dist, pz = -66.86;
  const pos = M.positionAt(px, pz);
  const yaw = Math.atan2(-(196.55 - px), -(-66.86 - pz));
  await page.goto(`http://localhost:8765/prototypes/microvoxel-world.html?seed=2718&gallery=1&cx=${pos.cx}&cz=${pos.cz}&lx=${pos.x}&lz=${pos.z}&walk=1&yaw=${yaw}`);
  try {
    await page.waitForFunction(() => {
      const s = window.MicroWorldLab && window.MicroWorldLab.snapshot();
      return s && !s.failed && s.ready > 0 && s.ready === s.visible && !s.pending;
    }, null, { timeout: 180000 });
  } catch (e) { console.log('ready-timeout'); }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/crystal-shot.png', timeout: 60000 });
  console.log('shot crystal');
  await browser.close();
})().catch(e => { console.log('ERR', e); process.exit(1); });
