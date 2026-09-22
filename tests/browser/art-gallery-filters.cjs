const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.SPACOLOGY_BASE_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(base + '/prototypes/art-gallery.html');
    await page.locator('[data-filter="enemy"]').click();
    assert.equal(await page.locator('[data-filter="all"]').isVisible(), true,
      'Filtering enemies hides the navigation needed to return to all artwork');
    assert.equal(await page.locator('[data-section="lore"]').isVisible(), false);
    assert.equal(await page.locator('[data-section="enemy"]').isVisible(), true);
    await page.locator('[data-filter="lore"]').click();
    assert.equal(await page.locator('[data-section="lore"]').isVisible(), true);
    assert.equal(await page.locator('[data-section="enemy"]').isVisible(), false);
    await page.locator('[data-filter="all"]').click();
    assert.equal(await page.locator('[data-section="lore"]').isVisible(), true);
    assert.equal(await page.locator('[data-section="enemy"]').isVisible(), true);
    console.log('PASS archive filter round trip: enemies → lore → all');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
