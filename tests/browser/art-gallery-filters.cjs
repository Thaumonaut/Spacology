const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.SPACOLOGY_BASE_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ headless:process.env.SPACOLOGY_HEADED !== '1' });
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
    assert.equal(await page.locator('#loreGrid .card').count(), 30,
      'The lore archive does not show the complete playable roster');
    await page.locator('#loreGrid .card').filter({ hasText: 'The Mage' }).click();
    assert.equal(await page.locator('#archiveDialog').getAttribute('open') !== null, true,
      'Clicking a portrait did not open its full lore view');
    assert.equal(await page.locator('#dialogMoves').getByText('J3K Lottery').isVisible(), true,
      'The Mage lore view does not describe the J3K summon ability');
    await page.locator('#dialogClose').click();
    await page.locator('[data-filter="summon"]').click();
    assert.equal(await page.locator('#summonGrid .card').count(), 3,
      'The archive does not show all three J3K units');
    await page.locator('[data-filter="all"]').click();
    assert.equal(await page.locator('[data-section="lore"]').isVisible(), true);
    assert.equal(await page.locator('[data-section="summon"]').isVisible(), true);
    assert.equal(await page.locator('[data-section="enemy"]').isVisible(), true);
    assert.equal(await page.locator('#enemyGrid .card').count(), 7,
      'The archive does not show all seven enemy factions');
    assert.equal(await page.locator('#enemyTypeGroups .card').count(), 44,
      'The archive does not show every faction-specific combat type');
    assert.equal(await page.locator('#enemyTypeGroups .faction-group').count(), 7,
      'The combat-type catalogue is not grouped into all seven factions');
    await page.locator('#enemyTypeGroups .card').first().click();
    assert.match(await page.locator('#dialogMoves').innerText(), /Silhouette cue/,
      'Combat-type portraits do not open their catalogue details');
    await page.locator('#dialogClose').click();
    console.log('PASS archive filters, roster counts, and clickable lore dialog');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
