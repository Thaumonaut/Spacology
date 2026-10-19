import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, GATE_TYPES, PLAYER_Z, squadColumns, squadMemberX, squadMemberZ } from '../src/game.js';
import { ENEMY, BULLET } from '../src/ecs.js';

test('enemies keep spawning while upgrade gates are on the road', () => {
  const game = new Game();
  game.start();
  game.hitPlayer = () => {};
  game.updateFiring = () => {};
  let overlappingFrames = 0;
  for (let frame = 0; frame < 18 * 60; frame++) {
    game.update(1 / 60);
    if (game.rows.length && game.world.countMask(ENEMY)) overlappingFrames++;
  }
  assert.ok(overlappingFrames > 300, 'gates should arrive during a sustained swarm');
  assert.ok(game.wave >= 2, 'surges should escalate on their own timer');
  assert.ok(game.world.countMask(ENEMY) > 0, 'the enemy stream should still be active');
});

test('a live run keeps enemies visible at early and late waves while shooters fire', () => {
  for (const wave of [1, 13]) {
    const game = new Game();
    game.start();
    game.wave = wave === 1 ? 0 : wave;
    game.waveTimer = wave === 1 ? 0 : 8;
    game.squadSize = wave === 13 ? 41 : 8;
    game.hitPlayer = () => {};
    for (let frame = 0; frame < 8 * 60; frame++) {
      game.update(1 / 60);
      if (wave !== 1 && frame < 120) continue;
      let visible = 0;
      for (let i = 0; i < game.world.count; i++) {
        const id = game.world.dense[i];
        if (game.world.mask[id] === ENEMY && game.world.z[id] > -58) visible++;
      }
      assert.ok(visible > 0, `wave ${wave} has no incoming target on frame ${frame}`);
    }
  }
});

test('escaped enemies remove shooters, and the last loss ends the run', () => {
  const game = new Game();
  game.start();
  game.wave = 1;
  game.waveTimer = game.gateTimer = game.spawnTimer = game.bossTimer = 12;
  game.updateFiring = () => {};
  game.world.create(ENEMY, { x: 0, z: PLAYER_Z - .1, vz: 10, hp: 1, size: .9 });
  game.world.create(ENEMY, { x: 0, z: PLAYER_Z - .1, vz: 10, hp: 20, size: 2.6, kind: 3 });
  game.update(1 / 60);
  assert.equal(game.squadSize, 4);
  assert.equal(game.escaped, 2);
  game.squadSize = 1;
  game.world.create(ENEMY, { x: 0, z: PLAYER_Z - .1, vz: 10, hp: 1, size: .9 });
  game.update(1 / 60);
  assert.equal(game.squadSize, 0);
  assert.equal(game.phase, 'over');
});

test('later surges add more enemies to each continuous group', () => {
  const game = new Game();
  game.wave = 1;
  game.spawnPack();
  assert.equal(game.world.countMask(ENEMY), 2);
  game.world.clear();
  game.wave = 9;
  game.waveTimer = 5;
  game.spawnPack();
  assert.equal(game.world.countMask(ENEMY), 6);
});

test('recruitment moves on the left, enemies stay centered, and gun gates appear later on the right', () => {
  const game = new Game();
  game.wave = 1;
  game.spawnGateRow();
  const [left, middle, right] = game.rows[0].ids;
  assert.equal(middle, 0);
  assert.equal(GATE_TYPES[game.world.kind[left]], 'recruit');
  assert.equal(right, 0);
  game.wave = 5;
  game.spawnGateRow();
  const cannonGate = game.rows.at(-1).ids[2];
  assert.equal(GATE_TYPES[game.world.kind[cannonGate]], 'cannon');
  for (let i = 0; i < 10; i++) game.spawnPack();
  for (let i = 0; i < game.world.count; i++) {
    const id = game.world.dense[i];
    if (game.world.mask[id] === ENEMY) assert.ok(Math.abs(game.world.x[id]) <= 2.1);
  }
  game.playerX = 0;
  game.world.z[left] = PLAYER_Z - .1;
  game.updateRows(.1, 2);
  assert.equal(game.squadSize, 8, 'holding the middle should not collide with a recruitment wall');
});

test('boss groups grow and their arrival interval shrinks in later surges', () => {
  const game = new Game();
  game.wave = 3;
  const earlyInterval = game.bossInterval();
  game.spawnBossGroup();
  assert.equal(game.stats().bosses, 1);
  game.world.clear();
  game.wave = 28;
  assert.ok(game.bossInterval() < earlyInterval);
  game.spawnBossGroup();
  assert.ok(game.stats().bosses > 1);
});

test('enemies advance faster than the upgrade walls', () => {
  const game = new Game();
  game.wave = 1;
  game.spawnGateRow();
  game.spawnPack();
  const enemy = [...game.world.dense.slice(0, game.world.count)].find(id => game.world.mask[id] === ENEMY);
  assert.ok(game.world.vz[enemy] > 11.5 + game.wave * .18);
});

test('the stationary cannon damages enemies and the shock gun slows them', () => {
  const game = new Game();
  game.start();
  game.waveTimer = game.gateTimer = game.spawnTimer = game.bossTimer = 12;
  game.updateFiring = () => {};
  game.upgrade('cannon');
  const enemy = game.world.create(ENEMY, { x: 0, z: -20, vz: 0, hp: 4, size: .9 });
  const neighbor = game.world.create(ENEMY, { x: .6, z: -19.5, vz: 0, hp: 4, size: .9 });
  for (let i = 0; i < 50; i++) game.update(1 / 60);
  assert.equal(game.world.alive(enemy), false, 'stationary cannon should kill without squad fire');
  assert.equal(game.world.alive(neighbor), false, 'cannon blast should damage a nearby enemy');
  assert.equal(game.kills, 2);
  game.upgrade('shock');
  const slowed = game.world.create(ENEMY, { x: 0, z: -20, vz: 20, hp: 4, size: .9 });
  game.pulseShock();
  assert.ok(game.world.slow[slowed] > 1);
  const before = game.world.z[slowed];
  game.updateEntities(1);
  assert.ok(game.world.z[slowed] - before < 11, 'shock should reduce enemy travel speed');
});

test('breaking a wall awards its perk immediately and only once', () => {
  const game = new Game();
  game.start();
  game.wave = 1;
  game.spawnGateRow();
  const left = game.rows[0].ids[0];
  const w = game.world;
  const bullet = w.create(BULLET, { x: w.x[left], z: w.z[left], damage: w.hp[left] });
  game.collideBullets();
  assert.equal(w.hp[left], 0);
  assert.equal(w.alive(bullet), false);
  assert.equal(game.squadSize, 14);
  assert.equal(game.rows[0].resolved, false);
  game.playerX = -5;
  w.z[left] = PLAYER_Z - .1;
  game.updateRows(.1, 2);
  assert.equal(game.squadSize, 14);
});

test('each squad member fires on a staggered timer from their visible position', () => {
  const game = new Game();
  game.playerX = 0;
  const w = game.world;
  const columns = squadColumns(game.squadSize);
  game.updateFiring(1 / 60);
  assert.ok(w.countMask(BULLET) < game.squadSize, 'the first frame should not fire a synchronized volley');
  for (let frame = 1; frame < 10; frame++) game.updateFiring(1 / 60);
  assert.equal(w.countMask(BULLET), game.squadSize);
  for (let member = 0; member < game.squadSize; member++) {
    const bullet = w.dense[member];
    assert.ok(Math.abs(w.x[bullet] - squadMemberX(member, columns, game.playerX)) < .00001);
    assert.ok(Math.abs(w.z[bullet] - (squadMemberZ(member, columns) - .55)) < .00001);
    assert.equal(w.vx[bullet], 0);
  }
  w.clear();
  game.upgrade('recruit');
  game.updateFiring(game.fireInterval);
  assert.equal(w.countMask(BULLET), 14, 'new squad members should add real firepower');
});

test('shooters on an upgrade lane split fire between its wall and the swarm', () => {
  const game = new Game();
  game.wave = 1;
  game.spawnGateRow();
  game.playerX = -5;
  for (let frame = 0; frame < 10; frame++) game.updateFiring(1 / 60);
  const w = game.world;
  const bullets = [...w.dense.slice(0, w.count)].filter(id => w.mask[id] === BULLET);
  assert.equal(bullets.length, game.squadSize);
  assert.equal(bullets.filter(id => w.kind[id] === 2 && w.vx[id] > 0).length, 4);
  assert.equal(bullets.filter(id => w.kind[id] === 3 && w.vx[id] === 0).length, 4);
});

test('the shock gun unlocks after the stationary cannon and later waves', () => {
  const game = new Game();
  const w = game.world;
  game.wave = 4;
  game.spawnGateRow();
  assert.equal(game.rows.at(-1).ids[2], 0);
  game.wave = 5;
  game.spawnGateRow();
  const cannonWall = game.rows.at(-1).ids[2];
  assert.equal(GATE_TYPES[w.kind[cannonWall]], 'cannon');
  assert.ok(w.hp[cannonWall] > w.hp[game.rows.at(-1).ids[0]]);
  game.upgrade('cannon');
  game.wave = 7;
  game.spawnGateRow();
  assert.equal(GATE_TYPES[w.kind[game.rows.at(-1).ids[2]]], 'cannon');
  game.wave = 8;
  game.spawnGateRow();
  assert.equal(GATE_TYPES[w.kind[game.rows.at(-1).ids[2]]], 'shock');
});

test('a full squad leaves the left lane clear while right gun upgrades continue', () => {
  const game = new Game();
  game.start();
  game.wave = 24;
  game.squadSize = game.maxSquad = 60;
  game.cannonLevel = game.shockLevel = 6;
  game.spawnGateRow();
  const row = game.rows[0], w = game.world;
  assert.equal(row.ids[0], 0);
  assert.equal(GATE_TYPES[w.kind[row.ids[2]]], 'cannon');
  const gate = row.ids[2];
  w.create(BULLET, { x: w.x[gate], z: w.z[gate], damage: w.hp[gate] });
  game.collideBullets();
  assert.equal(game.cannonLevel, 7);
  w.z[gate] = PLAYER_Z - .1;
  game.playerX = 5;
  game.updateRows(.1, 2);
  assert.equal(game.squadSize, 60);
});
