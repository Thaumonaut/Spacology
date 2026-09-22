const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.SPACOLOGY_BASE_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ headless: false });
  try {
    for (const hasTouch of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch, serviceWorkers: 'block' });
      const page = await context.newPage();
      await page.goto(base + '/prototypes/spacology-v0.1.0.html');
      if (await page.locator('#enterOps').count()) await page.locator('#enterOps').click();
      await page.locator('[data-open]').first().click();
      const crew = await page.locator('.reward-card.has-portrait').evaluateAll(cards => cards.map(card => {
        const bounds = card.getBoundingClientRect();
        const name = card.querySelector('b').getBoundingClientRect();
        const actions = card.querySelector('.reward-actions').getBoundingClientRect();
        return { name: card.querySelector('b').textContent, top: name.top, bottom: name.bottom, cardTop: bounds.top, cardBottom: bounds.bottom, actionsTop: actions.top };
      }));
      assert.equal(crew.length, 2);
      for (const card of crew) {
        assert(card.top >= card.cardTop && card.bottom <= card.cardBottom,
          `${hasTouch ? 'touch' : 'mouse'} ${card.name}: name clipped by card ${JSON.stringify(card)}`);
        assert(card.bottom <= card.actionsTop, `${card.name}: quick actions cover name`);
      }
      console.log('PASS crew pack labels visible, touch=' + hasTouch);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
