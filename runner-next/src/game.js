import { World, ENEMY, BULLET, GATE } from './ecs.js';

export const PLAYER_Z = 7;
export const LANE_X = [-5, 0, 5];
export const GATE_TYPES = ['recruit', 'cannon', 'shock'];
export const CANNON_X = 7.2;
export const CANNON_Z = 2;
const KIND = { drone: 0, dart: 1, brute: 2, boss: 3 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const WAVE_SECONDS = 8;
const GATE_SECONDS = 12;

export const squadColumns = count => Math.min(6, Math.ceil(Math.sqrt(count * 1.4)));
export const squadMemberX = (index, columns, centerX) => centerX + (index % columns - (columns - 1) / 2) * .9;
export const squadMemberZ = (index, columns) => PLAYER_Z - .6 - Math.floor(index / columns);

export class Game {
  constructor(onEvent = () => {}) {
    this.world = new World(14000);
    this.bulletScratch = [];
    this.onEvent = onEvent;
    this.reset();
  }

  reset() {
    this.world.clear();
    this.phase = 'ready';
    this.time = 0;
    this.distance = 0;
    this.wave = 0;
    this.kills = 0;
    this.squadSize = 8;
    this.maxSquad = 8;
    this.invulnerable = 0;
    this.escaped = 0;
    this.damage = 2;
    this.fireInterval = .18;
    this.fireTimers = new Float32Array(60);
    this.activeShooters = this.squadSize;
    for (let i = 0; i < this.squadSize; i++) this.fireTimers[i] = i * this.fireInterval / this.squadSize;
    this.cannonLevel = 0;
    this.shockLevel = 0;
    this.shockFlash = 0;
    this.cannonTimer = 0;
    this.cannonAim = 0;
    this.shockTimer = 0;
    this.playerX = 0;
    this.targetX = 0;
    this.waveTimer = 0;
    this.gateTimer = .6;
    this.spawnTimer = .12;
    this.bossTimer = 2;
    this.rows = [];
    this.emit('hud');
  }

  emit(type, detail = '') { this.onEvent(type, detail, this.stats()); }
  start() {
    if (this.phase !== 'paused') this.reset();
    this.phase = 'running';
    this.emit('phase');
  }
  togglePause() {
    if (this.phase === 'running') this.phase = 'paused';
    else if (this.phase === 'paused') this.phase = 'running';
    else return;
    this.emit('phase');
  }
  steer(x) { this.targetX = clamp(x, -7.5, 7.5); }
  hitPlayer(loss = 1, announce = false) {
    if (this.phase !== 'running') return;
    this.squadSize = Math.max(0, this.squadSize - loss);
    this.invulnerable = .2;
    if (announce && this.squadSize) this.emit('toast', `SQUAD -${loss} · ${this.squadSize} LEFT`);
    if (this.squadSize === 0) {
      this.phase = 'over';
      this.emit('gameover');
    }
  }

  spawnGateRow() {
    const gun = this.wave < 5 ? null : this.cannonLevel === 0 ? 'cannon' :
      this.wave >= 8 && this.shockLevel < 6 && this.shockLevel < this.cannonLevel ? 'shock' : 'cannon';
    const createGate = (type, lane) => {
      const hp = type === 'recruit' ? Math.ceil(this.squadSize * this.damage * 3 + this.wave * 2) :
        Math.ceil(this.squadSize * this.damage * (.18 / this.fireInterval) * (type === 'shock' ? 6 : 5) + this.wave * 5);
      return this.world.create(GATE, { x: LANE_X[lane], y: 1.5, z: -80, hp, size: 3.7,
        kind: GATE_TYPES.indexOf(type), damage: type === 'recruit' ? 6 + Math.floor(this.wave / 5) : 0 });
    };
    const ids = [this.squadSize < 60 ? createGate('recruit', 0) : 0, 0, gun ? createGate(gun, 2) : 0];
    this.rows.push({ ids, anchor: ids[0] || ids[2], resolved: false });
  }

  spawnWave() {
    this.wave++;
    this.waveTimer = WAVE_SECONDS;
    if (this.wave === 1) {
      for (const z of [-17, -28, -39, -50]) {
        this.addEnemy({ kind: KIND.drone, wave: 1, x: -.9, z });
        this.addEnemy({ kind: KIND.drone, wave: 1, x: .9, z });
      }
    }
    this.emit('toast', `SURGE ${String(this.wave).padStart(2, '0')} · SWARM INCOMING`);
  }

  spawnPack() {
    const count = Math.min(10, 2 + Math.floor((this.wave - 1) / 2));
    const spread = Math.min(2.1, .8 + (this.wave - 1) * .065);
    for (let i = 0; i < count; i++) {
      const kind = this.wave >= 5 && i === count - 1 && Math.random() < .12 ? KIND.brute :
        this.wave >= 3 && Math.random() < .14 ? KIND.dart : KIND.drone;
      const x = (i - (count - 1) / 2) * (spread * 2 / Math.max(1, count - 1)) + (Math.random() - .5) * .25;
      this.addEnemy({ kind, wave: this.wave, x });
    }
  }

  spawnBossGroup() {
    const count = Math.min(4, 1 + Math.floor(Math.max(0, this.wave - 13) / 10));
    for (let i = 0; i < count; i++) {
      this.addEnemy({ kind: KIND.boss, wave: this.wave, x: (Math.random() - .5) * 2.5 });
    }
  }

  bossInterval() { return Math.max(2.3, 8 - this.wave * .22); }

  addEnemy(entry) {
    const x = clamp(entry.x ?? (Math.random() - .5) * 4.2, -2.1, 2.1);
    const hp = Math.ceil((entry.kind === KIND.boss ? 36 : entry.kind === KIND.brute ? 12 : entry.kind === KIND.dart ? 4 : 3) * (1 + Math.floor((entry.wave - 1) / 4) * .25));
    const speed = entry.kind === KIND.dart ? 27 : entry.kind === KIND.boss ? 17 : entry.kind === KIND.brute ? 19 : 22;
    this.world.create(ENEMY, { x, y: entry.kind === KIND.boss ? 1.5 : .85,
      z: entry.z ?? -52 - Math.random() * 8, vz: speed + Math.min(7, entry.wave * .32),
      hp, size: entry.kind === KIND.boss ? 2.6 : entry.kind === KIND.brute ? 1.55 : .9,
      kind: entry.kind, phase: Math.random() * 6.28 });
  }

  fireMember(member, columns = squadColumns(this.squadSize), laneGate = false) {
    const muzzleX = squadMemberX(member, columns, this.playerX);
    const muzzleZ = squadMemberZ(member, columns) - .55;
    const sideLane = Math.abs(this.playerX) > 2.5;
    const cover = sideLane && (!laneGate || member % 2 === 0);
    const kind = cover ? 2 : sideLane ? 3 : 0;
    const vx = cover ? -muzzleX * 70 / (muzzleZ + 24) : 0;
    this.world.create(BULLET, { x: muzzleX, y: 1.05, z: muzzleZ,
      vx, vz: -70, hp: 1, size: .18, damage: this.damage, kind });
  }

  updateFiring(dt) {
    if (this.activeShooters > this.squadSize) this.activeShooters = this.squadSize;
    if (this.activeShooters < this.squadSize) {
      const added = this.squadSize - this.activeShooters;
      for (let i = 0; i < added; i++) {
        this.fireTimers[this.activeShooters + i] = (i + .5) * this.fireInterval / added;
      }
      this.activeShooters = this.squadSize;
    }
    const columns = squadColumns(this.squadSize);
    const lane = this.playerX < -2.5 ? 0 : this.playerX > 2.5 ? 2 : 1;
    let laneGate = false;
    if (lane !== 1) {
      for (const row of this.rows) {
        const gate = row.ids[lane];
        if (gate && !row.resolved && this.world.hp[gate] > 0) { laneGate = true; break; }
      }
    }
    for (let member = 0; member < this.squadSize; member++) {
      this.fireTimers[member] -= dt;
      if (this.fireTimers[member] <= 0) {
        this.fireMember(member, columns, laneGate);
        this.fireTimers[member] += this.fireInterval;
      }
    }
  }

  fireCannon() {
    const w = this.world;
    let target = 0, best = -Infinity;
    for (let i = 0; i < w.count; i++) {
      const id = w.dense[i];
      if (w.mask[id] !== ENEMY || w.hp[id] <= 0 || w.z[id] < -24 || w.z[id] >= PLAYER_Z) continue;
      const threat = w.z[id] + (w.kind[id] >= KIND.brute ? 7 : 0);
      if (threat > best) { best = threat; target = id; }
    }
    if (!target) return;
    const travel = Math.hypot(CANNON_X - w.x[target], CANNON_Z - w.z[target]) / 80;
    const leadZ = Math.min(PLAYER_Z - .5, w.z[target] + w.vz[target] * travel * (w.slow[target] > 0 ? .45 : 1));
    const dx = w.x[target] - CANNON_X, dz = leadZ - CANNON_Z;
    const speed = 80 / Math.hypot(dx, dz);
    this.cannonAim = Math.atan2(-dx, -dz);
    w.create(BULLET, { x: CANNON_X, y: 1.3, z: CANNON_Z, vx: dx * speed, vz: dz * speed,
      hp: 1, size: .24, damage: 2 + this.cannonLevel * 2, kind: 1 });
  }

  pulseShock() {
    const w = this.world;
    let slowed = 0;
    for (let i = 0; i < w.count; i++) {
      const id = w.dense[i];
      if (w.mask[id] !== ENEMY || w.hp[id] <= 0 || w.z[id] < -48 || w.z[id] >= PLAYER_Z) continue;
      w.slow[id] = Math.max(w.slow[id], 1.2 + this.shockLevel * .35);
      slowed++;
    }
    if (slowed) this.shockFlash = .4;
  }

  upgrade(type, recruits = 6 + Math.floor(this.wave / 5)) {
    if (type === 'recruit') {
      this.squadSize = Math.min(60, this.squadSize + recruits);
      this.maxSquad = Math.max(this.maxSquad, this.squadSize);
      this.emit('toast', `RECRUITS JOIN · ${this.squadSize} SHOOTERS`);
    } else if (type === 'cannon') {
      this.cannonLevel++;
      this.cannonTimer = 0;
      this.emit('toast', `STATIONARY CANNON · LEVEL ${this.cannonLevel}`);
    } else if (type === 'shock') {
      this.shockLevel = Math.min(6, this.shockLevel + 1);
      this.shockTimer = 0;
      this.emit('toast', `SHOCK GUN · LEVEL ${this.shockLevel}`);
    }
  }

  updateRows(dt, speed) {
    const w = this.world;
    for (let i = this.rows.length - 1; i >= 0; i--) {
      const row = this.rows[i];
      for (const id of row.ids) if (id) w.z[id] += speed * dt;
      const z = w.z[row.anchor];
      if (!row.resolved && z >= PLAYER_Z) {
        row.resolved = true;
        const lane = this.playerX < -2.5 ? 0 : this.playerX > 2.5 ? 2 : 1;
        const gate = row.ids[lane];
        if (gate && w.hp[gate] > 0) this.hitPlayer(2, true);
      }
      if (z > PLAYER_Z + 8) {
        for (const id of row.ids) if (id) w.destroy(id);
        this.rows.splice(i, 1);
      }
    }
  }

  updateEntities(dt) {
    const w = this.world;
    for (let i = 0; i < w.count;) {
      const id = w.dense[i], mask = w.mask[id];
      if (mask === BULLET) {
        w.x[id] += w.vx[id] * dt;
        w.z[id] += w.vz[id] * dt;
        const minZ = w.kind[id] === 1 ? -42 : w.kind[id] === 3 ? -90 : -16;
        if (w.z[id] < minZ || w.z[id] > PLAYER_Z + 8 || Math.abs(w.x[id]) > 9) { w.destroy(id); continue; }
      } else if (mask === ENEMY) {
        w.slow[id] = Math.max(0, w.slow[id] - dt);
        w.z[id] += w.vz[id] * (w.slow[id] > 0 ? .45 : 1) * dt;
        if (w.kind[id] === KIND.dart) w.x[id] += Math.sin(this.time * 5 + w.phase[id]) * dt * .9;
        if (w.z[id] > -28 && w.kind[id] !== KIND.boss) {
          w.x[id] = clamp(w.x[id] + clamp(this.playerX - w.x[id], -1, 1) * dt * (w.kind[id] === KIND.dart ? 1.5 : .75), -2.1, 2.1);
        }
        if (w.z[id] >= PLAYER_Z) {
          this.escaped++;
          this.hitPlayer(w.kind[id] === KIND.boss ? 3 : w.kind[id] === KIND.brute ? 2 : 1);
          w.destroy(id);
          continue;
        }
      }
      i++;
    }
  }

  collideBullets() {
    const w = this.world;
    w.rebuildEnemyGrid();
    const bullets = this.bulletScratch;
    bullets.length = 0;
    for (let i = 0; i < w.count; i++) if (w.mask[w.dense[i]] === BULLET) bullets.push(w.dense[i]);
    for (const bullet of bullets) {
      if (!w.alive(bullet)) continue;
      let target = 0;
      let targetGate = false;
      if (w.kind[bullet] === 0 || w.kind[bullet] === 3) {
        for (const row of this.rows) {
          if (row.resolved) continue;
          const dz = Math.abs(w.z[bullet] - w.z[row.anchor]);
          if (dz > 2) continue;
          for (const gate of row.ids) {
            if (gate && w.hp[gate] > 0 && Math.abs(w.x[bullet] - w.x[gate]) < 1.75) { target = gate; targetGate = true; break; }
          }
          if (target) break;
        }
      }
      if (!target) target = w.nearbyEnemy(w.x[bullet], w.z[bullet], w.kind[bullet] === 1 ? 1.1 : .5);
      if (!target) continue;
      if (w.kind[bullet] === 1 && w.mask[target] === ENEMY) {
        const x = w.x[target], z = w.z[target], radius = Math.min(3.5, 1.55 + this.cannonLevel * .18);
        for (let i = 0; i < w.count;) {
          const enemy = w.dense[i];
          if (w.mask[enemy] === ENEMY && Math.abs(w.x[enemy] - x) < radius && Math.abs(w.z[enemy] - z) < radius) {
            w.hp[enemy] -= w.damage[bullet];
            if (w.hp[enemy] <= 0) { this.kills++; w.destroy(enemy); continue; }
          }
          i++;
        }
      } else {
        w.hp[target] -= w.damage[bullet];
        if (targetGate && w.hp[target] <= 0) this.upgrade(GATE_TYPES[w.kind[target]], w.damage[target]);
        if (w.mask[target] === ENEMY && w.hp[target] <= 0) {
          this.kills++;
          w.destroy(target);
        }
      }
      w.destroy(bullet);
    }
  }

  update(dt, input = 0) {
    if (this.phase !== 'running' && this.phase !== 'stress') return;
    this.time += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shockFlash = Math.max(0, this.shockFlash - dt);
    this.targetX = clamp(this.targetX + input * 12 * dt, -7.5, 7.5);
    this.playerX += (this.targetX - this.playerX) * Math.min(1, dt * 13);
    if (this.phase === 'stress') { this.updateStress(dt); return; }

    const wallSpeed = Math.min(15, 11.5 + this.wave * .18);
    this.distance += wallSpeed * dt;
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) this.spawnWave();
    this.gateTimer -= dt;
    if (this.gateTimer <= 0) { this.spawnGateRow(); this.gateTimer += GATE_SECONDS; }
    this.spawnTimer -= dt;
    while (this.spawnTimer <= 0) {
      this.spawnPack();
      this.spawnTimer += Math.max(.1, .28 - this.wave * .007);
    }
    if (this.wave >= 3) {
      this.bossTimer -= dt;
      if (this.bossTimer <= 0) {
        this.spawnBossGroup();
        this.bossTimer += this.bossInterval();
      }
    }
    this.updateFiring(dt);
    if (this.cannonLevel) {
      this.cannonTimer -= dt;
      while (this.cannonTimer <= 0) {
        this.fireCannon();
        this.cannonTimer += Math.max(.14, .42 - this.cannonLevel * .045);
      }
    }
    if (this.shockLevel) {
      this.shockTimer -= dt;
      if (this.shockTimer <= 0) {
        this.pulseShock();
        this.shockTimer += Math.max(1.15, 3.2 - this.shockLevel * .38);
      }
    }
    this.updateRows(dt, wallSpeed);
    this.updateEntities(dt);
    if (this.phase === 'running') this.collideBullets();
  }

  startStress() {
    this.reset();
    this.phase = 'stress';
    const w = this.world;
    for (let i = 0; i < 2000; i++) {
      w.create(ENEMY, { x: (Math.random() - .5) * 15, y: .7, z: -100 + Math.random() * 106, vz: 4 + Math.random() * 5, hp: 20, size: .7, kind: i % 16 === 0 ? KIND.brute : i % 7 === 0 ? KIND.dart : KIND.drone, phase: Math.random() * 6 });
    }
    for (let i = 0; i < 6000; i++) {
      w.create(BULLET, { x: (Math.random() - .5) * 15, y: .8, z: -100 + Math.random() * 107, vz: -45 - Math.random() * 20, hp: 1, size: .13 });
    }
    this.emit('phase');
  }

  updateStress(dt) {
    const w = this.world;
    for (let i = 0; i < w.count; i++) {
      const id = w.dense[i];
      if (w.mask[id] === ENEMY) {
        w.z[id] += w.vz[id] * dt;
        if (w.z[id] > 8) w.z[id] = -100;
      } else if (w.mask[id] === BULLET) {
        w.z[id] += w.vz[id] * dt;
        if (w.z[id] < -101) w.z[id] = 7;
      }
    }
    w.rebuildEnemyGrid();
    for (let i = 0; i < w.count; i++) {
      const bullet = w.dense[i];
      if (w.mask[bullet] !== BULLET) continue;
      const enemy = w.nearbyEnemy(w.x[bullet], w.z[bullet], .3);
      if (enemy) {
        w.hp[enemy]--;
        if (w.hp[enemy] <= 0) { w.hp[enemy] = 20; w.z[enemy] = -100; }
        w.z[bullet] = 7;
      }
    }
    this.distance += 17 * dt;
  }

  stats() {
    let enemies = 0, bosses = 0, bullets = 0, closeEnemies = 0;
    const w = this.world;
    for (let i = 0; i < w.count; i++) {
      const id = w.dense[i];
      if (w.mask[id] === ENEMY) { enemies++; if (w.kind[id] === KIND.boss) bosses++; if (w.z[id] > -22) closeEnemies++; }
      else if (w.mask[id] === BULLET) bullets++;
    }
    return { phase: this.phase, wave: this.wave, distance: Math.floor(this.distance),
      squad: this.squadSize, maxSquad: this.maxSquad, escaped: this.escaped,
      cannonLevel: this.cannonLevel, shockLevel: this.shockLevel,
      kills: this.kills, enemies, bosses, bullets, closeEnemies };
  }
}
