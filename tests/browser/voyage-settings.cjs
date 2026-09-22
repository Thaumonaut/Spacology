const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.SPACOLOGY_BASE_URL || 'http://127.0.0.1:4173';
const game = base + '/prototypes/spacology-v0.1.0.html';
const setup = base + '/docs/testing/manual-playtest.html';
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('spacologyRunV010')));

(async () => {
  const browser = await chromium.launch({ headless:process.env.SPACOLOGY_HEADED !== '1' });
  try {
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(game);
    assert.equal((await state(page)).integrity, 70);
    assert.equal((await state(page)).difficulty, 'standard');
    console.log('PASS new voyage defaults to 70 integrity and standard difficulty');

    await page.goto(setup);
    await page.locator('#t01').check();
    await page.locator('#notes').fill('Testing different difficulty presets.');
    await page.locator('#difficulty').selectOption('hard');
    await page.locator('#initialIntegrity').selectOption('50');
    page.once('dialog', d => d.dismiss());
    await page.locator('#reset').click();
    assert.equal((await state(page)).integrity, 70);
    page.once('dialog', d => d.accept());
    await page.locator('#reset').click();
    assert.equal(await state(page), null);
    await page.reload();
    assert.equal(await page.locator('#notes').inputValue(), 'Testing different difficulty presets.');
    assert(await page.locator('#t01').isChecked());
    await page.goto(game);
    await page.locator('#enterOps').click();
    assert.equal((await state(page)).integrity, 50);
    assert.equal((await state(page)).difficulty, 'hard');
    await page.locator('[data-info="modifiers"]').click();
    assert.match(await page.locator('#modalBody').innerText(), /130%/);
    console.log('PASS setup reset is confirmed, applies selected settings and preserves test notes');

    // Changing future defaults must not rewrite a voyage already in progress.
    await page.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('spacologyRunV010'));
      run.integrity = 42;
      localStorage.setItem('spacologyRunV010', JSON.stringify(run));
      localStorage.setItem('spacologyPlaytestConfigV010', JSON.stringify({ difficulty: 'relaxed', initialIntegrity: 60 }));
    });
    await page.reload();
    assert.equal((await state(page)).integrity, 42);
    assert.equal((await state(page)).difficulty, 'hard');
    console.log('PASS resume preserves earned integrity and locks existing difficulty');

    const samples = {};
    for (const round of [1, 6]) {
      samples[round] = {};
      for (const difficulty of ['relaxed', 'standard', 'hard']) {
        await page.goto(game);
        await page.evaluate(({ round, difficulty }) => {
          const run = JSON.parse(localStorage.getItem('spacologyRunV010'));
          Object.assign(run, { round, difficulty, field: ['Tarn', ...Array(7).fill(null)], support: Array(8).fill(null), reserve: [], equipped: {}, shipEquipped: [] });
          localStorage.setItem('spacologyRunV010', JSON.stringify(run));
        }, { round, difficulty });
        await page.reload();
        await page.locator('#enterOps').click();
        await page.locator('#continueButton').click();
        await page.waitForURL('**/watchable-fight.html**');
        const sample = await page.evaluate(() => {
          cancelSessionAutostart();
          return { limit:G.limit, pool: G.pool.map(e => ({ hp: e.hp, dmg: e.dmg, sp: e.sp, guard: e.guard, elite: e.elite, wave: e.wave })), crew: G.units.filter(u => u.side === 'ally').map(u => ({ hp: u.max, dmg: u.dmg })), label: document.getElementById('sessionPressure').textContent };
        });
        assert.match(sample.label.toLowerCase(), new RegExp(difficulty));
        assert.equal(sample.pool.length, round === 1 ? 6 : 18);
        samples[round][difficulty] = sample;
      }
      const { relaxed, standard, hard } = samples[round];
      assert.equal(hard.limit,round===1?4:6);assert.equal(standard.limit,hard.limit+1);assert.equal(relaxed.limit,hard.limit+2);
      assert.deepEqual(relaxed.crew, standard.crew);
      assert.deepEqual(hard.crew, standard.crew);
      for (let i = 0; i < standard.pool.length; i++) {
        for (const stat of ['hp', 'dmg', 'sp', 'guard']) {
          assert(relaxed.pool[i][stat] < standard.pool[i][stat], `round ${round}, enemy ${i}, ${stat}: relaxed must be lower`);
          assert(hard.pool[i][stat] > standard.pool[i][stat], `round ${round}, enemy ${i}, ${stat}: hard must be higher`);
        }
        assert.equal(relaxed.pool[i].wave, hard.pool[i].wave);
        assert.equal(relaxed.pool[i].elite, hard.pool[i].elite);
      }
    }
    assert(samples[6].standard.pool[0].hp > samples[1].standard.pool[0].hp);
    console.log('PASS all difficulty presets affect every enemy, including later waves and elites; crew/counts unchanged');

    await page.goto(setup);
    const download = page.waitForEvent('download');
    await page.locator('#download').click();
    const report = await download;
    const fs = require('node:fs');
    const text = fs.readFileSync(await report.path(), 'utf8');
    assert.match(text, /Testing different difficulty presets/);
    assert.match(text, /"difficulty":"hard"/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false);
    for (const size of [{width:768,height:1024},{width:1024,height:768}]) {
      await page.setViewportSize(size);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    assert.deepEqual(errors, []);
    console.log('PASS checklist exports notes and actual run settings, fits tablet orientations, and has no page errors');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
