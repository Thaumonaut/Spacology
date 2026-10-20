export const ENEMY = 1;
export const BULLET = 2;
export const GATE = 4;

// Dense entity IDs and structure-of-arrays components keep movement and queries
// independent of Three.js objects. IDs are stable until an entity is destroyed.
export class World {
  constructor(capacity = 12000) {
    this.capacity = capacity;
    this.count = 0;
    this.nextId = 1;
    this.free = [];
    this.dense = new Uint32Array(capacity);
    this.sparse = new Uint32Array(capacity);
    this.mask = new Uint8Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.hp = new Float32Array(capacity);
    this.maxHp = new Float32Array(capacity);
    this.damage = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.phase = new Float32Array(capacity);
    this.slow = new Float32Array(capacity);
    this.gridHead = new Int32Array(12 * 40);
    this.gridNext = new Int32Array(capacity);
  }

  create(mask, values = {}) {
    const id = this.free.length ? this.free.pop() : this.nextId++;
    if (id >= this.capacity) throw new Error(`Entity capacity ${this.capacity} exceeded`);
    const slot = this.count++;
    this.dense[slot] = id;
    this.sparse[id] = slot + 1;
    this.mask[id] = mask;
    this.x[id] = values.x ?? 0;
    this.y[id] = values.y ?? 0;
    this.z[id] = values.z ?? 0;
    this.vx[id] = values.vx ?? 0;
    this.vz[id] = values.vz ?? 0;
    this.hp[id] = values.hp ?? 1;
    this.maxHp[id] = values.hp ?? 1;
    this.damage[id] = values.damage ?? 1;
    this.size[id] = values.size ?? 1;
    this.kind[id] = values.kind ?? 0;
    this.phase[id] = values.phase ?? 0;
    this.slow[id] = values.slow ?? 0;
    return id;
  }

  alive(id) { return id > 0 && id < this.capacity && this.sparse[id] !== 0; }

  destroy(id) {
    const position = this.sparse[id] - 1;
    if (position < 0) return false;
    const last = this.dense[--this.count];
    this.dense[position] = last;
    this.sparse[last] = position + 1;
    this.sparse[id] = 0;
    this.mask[id] = 0;
    this.free.push(id);
    return true;
  }

  clear() {
    this.count = 0;
    this.nextId = 1;
    this.free.length = 0;
    this.sparse.fill(0);
    this.mask.fill(0);
  }

  // A fixed broadphase grid cuts bullet queries from O(bullets × enemies)
  // to O(bullets × nearby enemies) across the visible 18 × 120 world.
  cell(x, z) {
    const col = Math.floor((x + 9) / 1.5);
    const row = Math.floor((z + 102) / 3);
    return col >= 0 && col < 12 && row >= 0 && row < 40 ? row * 12 + col : -1;
  }

  rebuildEnemyGrid() {
    this.gridHead.fill(-1);
    for (let i = 0; i < this.count; i++) {
      const id = this.dense[i];
      if (this.mask[id] !== ENEMY || this.hp[id] <= 0) continue;
      const cell = this.cell(this.x[id], this.z[id]);
      if (cell < 0) continue;
      this.gridNext[id] = this.gridHead[cell];
      this.gridHead[cell] = id;
    }
  }

  nearbyEnemy(x, z, radius = .65) {
    const col = Math.floor((x + 9) / 1.5);
    const row = Math.floor((z + 102) / 3);
    for (let rz = Math.max(0, row - 1); rz <= Math.min(39, row + 1); rz++) {
      for (let cx = Math.max(0, col - 1); cx <= Math.min(11, col + 1); cx++) {
        for (let id = this.gridHead[rz * 12 + cx]; id !== -1; id = this.gridNext[id]) {
          if (this.hp[id] > 0 && Math.abs(this.x[id] - x) < radius + this.size[id] * .45 && Math.abs(this.z[id] - z) < radius + this.size[id] * .5) return id;
        }
      }
    }
    return 0;
  }

  countMask(mask) {
    let count = 0;
    for (let i = 0; i < this.count; i++) if (this.mask[this.dense[i]] === mask) count++;
    return count;
  }
}
