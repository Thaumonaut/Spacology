'use strict';
const { chromium } = require('playwright');
const M = require('/Users/jek/Documents/Personal/Projects/Spacology/Spacology/prototypes/labs/microvoxel-world/voxel-world-model.js');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  const pos = M.positionAt(1079, 1017);
  const yaw = Math.atan2(-(-200), -(0)); // look -x across the meadow
  await page.goto(`http://localhost:8765/prototypes/microvoxel-world.html?seed=203749&cx=${pos.cx}&cz=${pos.cz}&lx=${pos.x}&lz=${pos.z}&walk=1&yaw=${yaw}`);
  try {
    await page.waitForFunction(() => {
      const s = window.MicroWorldLab && window.MicroWorldLab.snapshot();
      return s && !s.failed && s.ready > 0 && s.ready === s.visible && !s.pending;
    }, null, { timeout: 240000 });
  } catch (e) { console.log('ready-timeout'); }
  const s = await page.evaluate(() => window.MicroWorldLab.snapshot());
  console.log('level', s.level, 'ready', s.ready, 'draws', s.draws, 'tris', s.triangles);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/grass-walk.png', timeout: 60000 });
  console.log('shot grass-walk');
  await browser.close();
})().catch(e => { console.log('ERR', e); process.exit(1); });
