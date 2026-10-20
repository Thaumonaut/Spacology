import test from 'node:test';
import assert from 'node:assert/strict';
import { World, ENEMY, BULLET } from '../src/ecs.js';

test('dense IDs survive swap removal and reuse without ghost components', () => {
  const world = new World(8);
  const first = world.create(ENEMY, { x: 1, z: -3 });
  const middle = world.create(BULLET, { x: 2, z: -4 });
  const last = world.create(ENEMY, { x: 3, z: -5 });
  assert.equal(world.destroy(middle), true);
  assert.equal(world.count, 2);
  assert.equal(world.alive(last), true);
  assert.equal(world.alive(middle), false);
  const reused = world.create(BULLET, { x: 4, z: -6 });
  assert.equal(reused, middle);
  assert.equal(world.mask[reused], BULLET);
  assert.equal(world.x[reused], 4);
  assert.equal(world.alive(first), true);
});

test('spatial grid finds local targets among thousands and ignores distant ones', () => {
  const world = new World(4000);
  for (let i = 0; i < 2500; i++) world.create(ENEMY, { x: (i % 11) - 5, z: -90 + Math.floor(i / 11) % 30 * 3, hp: 2 });
  const target = world.create(ENEMY, { x: 7.4, z: -3.2, hp: 3 });
  world.rebuildEnemyGrid();
  assert.equal(world.nearbyEnemy(7.4, -3.2), target);
  assert.equal(world.nearbyEnemy(8.9, 10), 0);
  world.hp[target] = 0;
  assert.equal(world.nearbyEnemy(7.4, -3.2), 0);
});
