import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENEMY, BULLET, GATE } from './ecs.js';
import { GATE_TYPES, PLAYER_Z, CANNON_X, CANNON_Z, squadColumns, squadMemberX, squadMemberZ } from './game.js';

const PALETTE = { recruit: '#7de7e4', cannon: '#ffba78', shock: '#d4b0ff' };
const REWARD = { recruit: '+ 6 SHOOTERS', cannon: 'STATIONARY DAMAGE', shock: 'SLOW THE SWARM' };

function raiderGeometry(kind) {
  const parts = [];
  const bulk = kind === 2 || kind === 3 ? 1.25 : kind === 1 ? .78 : 1;
  const torso = new THREE.BoxGeometry(.65 * bulk, .83, .34 * bulk);
  torso.translate(0, .03, 0);
  parts.push(torso);
  const head = new THREE.BoxGeometry(.5 * bulk, .5 * bulk, .5 * bulk);
  head.translate(0, .68, -.08);
  parts.push(head);
  for (const side of [-1, 1]) {
    const arm = new THREE.BoxGeometry(.19 * bulk, .72, .25);
    arm.rotateZ(side * (kind === 1 ? .68 : .36));
    arm.translate(side * .47 * bulk, -.03, -.13);
    parts.push(arm);
    const leg = new THREE.BoxGeometry(.23 * bulk, .65, .28);
    leg.rotateZ(side * .09);
    leg.translate(side * .18 * bulk, -.68, .02);
    parts.push(leg);
  }
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
}

export class View {
  constructor(canvas, labelLayer) {
    this.canvas = canvas;
    this.labelLayer = labelLayer;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.maxPixelRatio = Math.min(devicePixelRatio || 1, 1.25);
    this.pixelRatio = this.maxPixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#10243b');
    this.scene.fog = new THREE.Fog('#18374e', 90, 175);
    this.camera = new THREE.PerspectiveCamera(64, 1, .1, 240);
    this.camera.position.set(0, 17, 22);
    this.camera.lookAt(0, 0, -18);
    this.temp = new THREE.Object3D();
    this.projected = new THREE.Vector3();
    this.gateLabels = new Map();
    this.buildWorld();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.ready = this.renderer.compileAsync(this.scene, this.camera).then(() => this.warmup()).catch(error => {
      console.warn('Shader precompile failed; continuing with on-demand compilation.', error);
    });
  }

  warmup() {
    // First use also allocates mesh buffers and VAOs. Do it behind the title
    // overlay so a newly arriving enemy archetype cannot stall active play.
    const meshes = [...this.enemies, this.squad, this.bullets, this.cannonBullets, ...this.gates, this.healthBack, this.healthFill];
    const matrix = new THREE.Matrix4().makeTranslation(0, 1, -30);
    for (const mesh of meshes) {
      mesh.setMatrixAt(0, matrix);
      mesh.count = 1;
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const [geometry, data] of [[this.enemyPointGeometry, this.enemyPointData], [this.bulletPointGeometry, this.bulletPointData]]) {
      data[0] = 0; data[1] = 1; data[2] = -30;
      geometry.setDrawRange(0, 1);
      geometry.attributes.position.needsUpdate = true;
    }
    this.cannonTower.visible = this.shockTower.visible = this.shockPulse.visible = true;
    this.renderer.render(this.scene, this.camera);
    this.cannonTower.visible = this.shockTower.visible = this.shockPulse.visible = false;
    for (const mesh of meshes) mesh.count = 0;
    this.enemyPointGeometry.setDrawRange(0, 0);
    this.bulletPointGeometry.setDrawRange(0, 0);
  }

  buildWorld() {
    this.scene.add(new THREE.HemisphereLight(0x9ddaff, 0x10152c, 2.3));
    const sun = new THREE.DirectionalLight(0x88e8ee, 2.1);
    sun.position.set(-8, 15, 8);
    this.scene.add(sun);

    const road = new THREE.Mesh(new THREE.PlaneGeometry(18.5, 230), new THREE.MeshBasicMaterial({ color: 0x72899a }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -.12, -94);
    this.scene.add(road);
    for (const [x, color] of [[-5, 0x176b9f], [0, 0x667b89], [5, 0x15669a]]) {
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 230), new THREE.MeshBasicMaterial({ color }));
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(x, -.105, -94);
      this.scene.add(lane);
    }
    for (const x of [-9.2, -3.1, 3.1, 9.2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(x === -9.2 || x === 9.2 ? .16 : .055, .06, 210), new THREE.MeshBasicMaterial({ color: x === -9.2 || x === 9.2 ? 0x7fd9f7 : 0xc1e5ed, transparent: true, opacity: .75 }));
      rail.position.set(x, .02, -90);
      this.scene.add(rail);
    }
    this.upgradeRibs = new THREE.InstancedMesh(new THREE.BoxGeometry(4.4, .04, .1), new THREE.MeshBasicMaterial({ color: 0x80cfff, transparent: true, opacity: .5 }), 80);
    this.upgradeRibs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.upgradeRibs);
    this.crossbars = new THREE.InstancedMesh(new THREE.BoxGeometry(18.3, .016, .06), new THREE.MeshBasicMaterial({ color: 0x407e91, transparent: true, opacity: .28 }), 24);
    this.crossbars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.crossbars);

    const enemyShapes = [0, 1, 2, 3].map(raiderGeometry);
    const enemyColors = [0xff5262, 0xe34469, 0xb82442, 0xff713f];
    this.enemies = enemyShapes.map((geometry, kind) => {
      const material = new THREE.MeshBasicMaterial({ color: enemyColors[kind] });
      const mesh = new THREE.InstancedMesh(geometry, material, [3000, 1000, 800, 100][kind]);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      return mesh;
    });
    this.squad = new THREE.InstancedMesh(enemyShapes[0], new THREE.MeshBasicMaterial({ color: 0x44c6ff }), 60);
    this.squad.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.squad.frustumCulled = false;
    this.scene.add(this.squad);
    const towerBase = new THREE.MeshBasicMaterial({ color: 0x225370 });
    const cannonTrim = new THREE.MeshBasicMaterial({ color: 0xffc479 });
    const shockTrim = new THREE.MeshBasicMaterial({ color: 0xbba7ff });
    this.cannonTower = new THREE.Group();
    this.cannonTower.position.set(CANNON_X, 0, CANNON_Z);
    const cannonBody = new THREE.Mesh(new THREE.CylinderGeometry(.62, .8, 1, 7), towerBase);
    cannonBody.position.y = .5;
    this.cannonTower.add(cannonBody);
    this.cannonBarrel = new THREE.Group();
    this.cannonBarrel.position.y = 1.25;
    this.cannonBarrel.add(new THREE.Mesh(new THREE.BoxGeometry(.7, .5, .8), cannonTrim));
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(.24, .24, 1.55), cannonTrim);
    barrel.position.z = -.9;
    this.cannonBarrel.add(barrel);
    this.cannonTower.add(this.cannonBarrel);
    this.cannonTower.visible = false;
    this.scene.add(this.cannonTower);
    this.shockTower = new THREE.Group();
    this.shockTower.position.set(CANNON_X, 0, CANNON_Z - 8);
    const shockBody = new THREE.Mesh(new THREE.CylinderGeometry(.57, .75, 1.2, 7), towerBase);
    shockBody.position.y = .6;
    this.shockTower.add(shockBody);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(.52, .14, 6, 12), shockTrim);
    coil.position.y = 1.55;
    this.shockTower.add(coil);
    this.shockTower.visible = false;
    this.scene.add(this.shockTower);
    this.shockPulse = new THREE.Mesh(new THREE.TorusGeometry(1.15, .035, 4, 32),
      new THREE.MeshBasicMaterial({ color: 0xbba7ff, transparent: true, opacity: .7, depthWrite: false }));
    this.shockPulse.position.set(CANNON_X, 1.6, CANNON_Z - 8);
    this.shockPulse.visible = false;
    this.scene.add(this.shockPulse);
    const healthShape = new THREE.PlaneGeometry(1, .16);
    this.healthBack = new THREE.InstancedMesh(healthShape, new THREE.MeshBasicMaterial({ color: 0x162838, side: THREE.DoubleSide, depthWrite: false }), 1000);
    this.healthFill = new THREE.InstancedMesh(healthShape, new THREE.MeshBasicMaterial({ color: 0xffd477, side: THREE.DoubleSide, depthWrite: false }), 1000);
    for (const mesh of [this.healthBack, this.healthFill]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    }
    this.enemyPointData = new Float32Array(4000 * 3);
    this.enemyPointGeometry = new THREE.BufferGeometry();
    this.enemyPointGeometry.setAttribute('position', new THREE.BufferAttribute(this.enemyPointData, 3).setUsage(THREE.DynamicDrawUsage));
    this.enemyPoints = new THREE.Points(this.enemyPointGeometry, new THREE.PointsMaterial({ color: 0xff5b69, size: 5, sizeAttenuation: false }));
    this.enemyPoints.frustumCulled = false;
    this.scene.add(this.enemyPoints);
    // Two-triangle streaks keep bullet overdraw and vertex work manageable.
    this.bullets = new THREE.InstancedMesh(new THREE.PlaneGeometry(.1, 1.1), new THREE.MeshBasicMaterial({ color: 0xb2fffa, side: THREE.DoubleSide }), 8500);
    this.bullets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bullets.frustumCulled = false;
    this.scene.add(this.bullets);
    this.cannonBullets = new THREE.InstancedMesh(new THREE.PlaneGeometry(.2, 1.25),
      new THREE.MeshBasicMaterial({ color: 0xffd78d, side: THREE.DoubleSide }), 128);
    this.cannonBullets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cannonBullets.frustumCulled = false;
    this.scene.add(this.cannonBullets);
    this.bulletPointData = new Float32Array(8500 * 3);
    this.bulletPointGeometry = new THREE.BufferGeometry();
    this.bulletPointGeometry.setAttribute('position', new THREE.BufferAttribute(this.bulletPointData, 3).setUsage(THREE.DynamicDrawUsage));
    this.bulletPoints = new THREE.Points(this.bulletPointGeometry, new THREE.PointsMaterial({ color: 0xa9fffb, size: .22, sizeAttenuation: true }));
    this.bulletPoints.frustumCulled = false;
    this.scene.add(this.bulletPoints);
    this.gates = GATE_TYPES.map(type => {
      const color = new THREE.Color(PALETTE[type]);
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(3.8, 2.9, .38), new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(.28), emissive: color, emissiveIntensity: .7, transparent: true, opacity: .82, metalness: .25 }), 12);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      return mesh;
    });
  }

  resize() {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  lowerResolution() {
    const next = Math.max(.7, Math.round((this.pixelRatio - .1) * 100) / 100);
    if (next >= this.pixelRatio) return false;
    this.pixelRatio = next;
    this.renderer.setPixelRatio(next);
    return true;
  }

  resetResolution() {
    this.pixelRatio = this.maxPixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
  }

  syncLabels(game) {
    const active = new Set();
    const w = game.world;
    for (const row of game.rows) for (const id of row.ids) {
      if (!w.alive(id)) continue;
      active.add(id);
      let label = this.gateLabels.get(id);
      if (!label) {
        label = document.createElement('div');
        label.className = 'gate-label';
        label.innerHTML = '<strong></strong><small></small><i><b></b></i>';
        label._type = null;
        label._hp = -1;
        label._visible = null;
        this.labelLayer.append(label);
        this.gateLabels.set(id, label);
      }
      const type = GATE_TYPES[w.kind[id]];
      this.projected.set(w.x[id], 2.1, w.z[id]).project(this.camera);
      const visible = w.hp[id] > 0 && this.projected.z < 1 && this.projected.z > -1 && w.z[id] > -68 && w.z[id] < PLAYER_Z + 4;
      if (label._visible !== visible) { label.style.display = visible ? '' : 'none'; label._visible = visible; }
      if (!visible) continue;
      const depth = Math.max(0, Math.min(1, (w.z[id] + 100) / 106));
      label.style.transform = `translate3d(${(this.projected.x + 1) * .5 * this.width}px,${(1 - this.projected.y) * .5 * this.height}px,0) translate(-50%,-50%) scale(${.52 + depth * .62})`;
      if (label._type !== type) {
        label.style.setProperty('--gate-color', PALETTE[type]);
        label.children[0].textContent = type.toUpperCase();
        label.children[1].textContent = type === 'recruit' ? `+ ${Math.round(w.damage[id])} SHOOTERS` : REWARD[type];
        label._type = type;
      }
      const hp = Math.max(0, Math.round(w.hp[id] / w.maxHp[id] * 100));
      if (label._hp !== hp) { label.children[2].firstElementChild.style.width = `${hp}%`; label._hp = hp; }
    }
    for (const [id, label] of this.gateLabels) if (!active.has(id)) { label.remove(); this.gateLabels.delete(id); }
  }

  render(game) {
    const w = game.world;
    const counts = [0, 0, 0, 0], gates = new Array(GATE_TYPES.length).fill(0);
    let bullets = 0, cannonBullets = 0, bulletPoints = 0, enemyPoints = 0, healthBars = 0;
    for (let i = 0; i < w.count; i++) {
      const id = w.dense[i], mask = w.mask[id];
      this.temp.position.set(w.x[id], w.y[id], w.z[id]);
      if (mask === ENEMY) {
        if (w.z[id] < (game.phase === 'stress' ? -24 : -58)) {
          if (enemyPoints >= 4000) continue;
          const offset = enemyPoints++ * 3;
          this.enemyPointData[offset] = w.x[id];
          this.enemyPointData[offset + 1] = w.y[id];
          this.enemyPointData[offset + 2] = w.z[id];
          continue;
        }
        const kind = w.kind[id], index = counts[kind]++;
        if (index >= this.enemies[kind].instanceMatrix.count) continue;
        this.temp.position.y += Math.abs(Math.sin(game.time * 8 + w.phase[id])) * .06;
        this.temp.rotation.set(0, Math.sin(game.time * 3 + w.phase[id]) * .12, Math.sin(game.time * 8 + w.phase[id]) * .06);
        this.temp.scale.setScalar(w.size[id]);
        this.temp.updateMatrix();
        this.enemies[kind].setMatrixAt(index, this.temp.matrix);
        if (kind >= 2 && healthBars < this.healthBack.instanceMatrix.count) {
          const bar = healthBars++;
          const width = kind === 3 ? 2.8 : 1.8;
          const hp = Math.max(0, Math.min(1, w.hp[id] / w.maxHp[id]));
          const height = w.y[id] + w.size[id] * 1.1 + .25;
          this.temp.position.set(w.x[id], height, w.z[id]);
          this.temp.rotation.set(0, 0, 0);
          this.temp.scale.set(width, 1, 1);
          this.temp.updateMatrix();
          this.healthBack.setMatrixAt(bar, this.temp.matrix);
          this.temp.position.x -= width * (1 - hp) / 2;
          this.temp.position.z += .01;
          this.temp.scale.x = width * Math.max(.001, hp);
          this.temp.updateMatrix();
          this.healthFill.setMatrixAt(bar, this.temp.matrix);
        }
      } else if (mask === BULLET) {
        if (w.kind[id] === 1) {
          if (cannonBullets >= this.cannonBullets.instanceMatrix.count) continue;
          this.temp.rotation.set(0, 0, 0);
          this.temp.scale.set(1, 1, 1);
          this.temp.updateMatrix();
          this.cannonBullets.setMatrixAt(cannonBullets++, this.temp.matrix);
          continue;
        }
        if (game.phase === 'stress' || w.z[id] < -20) {
          if (bulletPoints >= 8500) continue;
          const offset = bulletPoints++ * 3;
          this.bulletPointData[offset] = w.x[id];
          this.bulletPointData[offset + 1] = w.y[id];
          this.bulletPointData[offset + 2] = w.z[id];
          continue;
        }
        if (bullets >= this.bullets.instanceMatrix.count) continue;
        this.temp.rotation.set(0, 0, 0);
        this.temp.scale.setScalar(w.size[id] / .18);
        this.temp.updateMatrix();
        this.bullets.setMatrixAt(bullets++, this.temp.matrix);
      } else if (mask === GATE && w.hp[id] > 0) {
        const kind = w.kind[id], index = gates[kind]++;
        if (index >= this.gates[kind].instanceMatrix.count) continue;
        this.temp.rotation.set(0, 0, 0);
        this.temp.scale.set(1, 1, 1);
        this.temp.updateMatrix();
        this.gates[kind].setMatrixAt(index, this.temp.matrix);
      }
    }
    this.enemies.forEach((mesh, kind) => { mesh.count = Math.min(counts[kind], mesh.instanceMatrix.count); mesh.instanceMatrix.needsUpdate = mesh.count > 0; });
    this.gates.forEach((mesh, kind) => { mesh.count = Math.min(gates[kind], mesh.instanceMatrix.count); mesh.instanceMatrix.needsUpdate = mesh.count > 0; });
    this.bullets.count = Math.min(bullets, this.bullets.instanceMatrix.count);
    this.bullets.instanceMatrix.needsUpdate = bullets > 0;
    this.cannonBullets.count = cannonBullets;
    this.cannonBullets.instanceMatrix.needsUpdate = cannonBullets > 0;
    this.healthBack.count = this.healthFill.count = healthBars;
    this.healthBack.instanceMatrix.needsUpdate = this.healthFill.instanceMatrix.needsUpdate = healthBars > 0;
    this.enemyPointGeometry.setDrawRange(0, enemyPoints);
    if (enemyPoints) this.enemyPointGeometry.attributes.position.needsUpdate = true;
    this.bulletPointGeometry.setDrawRange(0, bulletPoints);
    if (bulletPoints) this.bulletPointGeometry.attributes.position.needsUpdate = true;

    for (let i = 0; i < 24; i++) {
      this.temp.position.set(0, .012, 8 - ((i * 8 + game.distance % 8) % 192));
      this.temp.rotation.set(0, 0, 0);
      this.temp.scale.set(1, 1, 1);
      this.temp.updateMatrix();
      this.crossbars.setMatrixAt(i, this.temp.matrix);
    }
    this.crossbars.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 80; i++) {
      this.temp.position.set(i < 40 ? -5 : 5, .04, 8 - (((i % 40) * 5 + game.distance % 5) % 200));
      this.temp.rotation.set(0, 0, 0);
      this.temp.scale.set(1, 1, 1);
      this.temp.updateMatrix();
      this.upgradeRibs.setMatrixAt(i, this.temp.matrix);
    }
    this.upgradeRibs.instanceMatrix.needsUpdate = true;
    const squadCount = game.phase === 'ready' ? 0 : Math.min(game.squadSize, this.squad.instanceMatrix.count);
    const columns = squadColumns(squadCount);
    for (let i = 0; i < squadCount; i++) {
      this.temp.position.set(squadMemberX(i, columns, game.playerX),
        .62 + Math.abs(Math.sin(game.time * 8 + i * 1.7)) * .05, squadMemberZ(i, columns));
      this.temp.rotation.set(0, Math.sin(game.time * 3 + i) * .08, 0);
      this.temp.scale.setScalar(.56);
      this.temp.updateMatrix();
      this.squad.setMatrixAt(i, this.temp.matrix);
    }
    this.squad.count = squadCount;
    this.squad.instanceMatrix.needsUpdate = squadCount > 0;
    this.squad.visible = !(game.invulnerable > 0 && Math.floor(game.time * 12) % 2);
    this.cannonTower.visible = game.cannonLevel > 0;
    this.cannonBarrel.rotation.y = game.cannonAim;
    this.shockTower.visible = game.shockLevel > 0;
    this.shockPulse.visible = game.shockFlash > 0;
    if (this.shockPulse.visible) {
      this.shockPulse.scale.setScalar(1 + (1 - game.shockFlash / .4) * 2.2);
      this.shockPulse.material.opacity = game.shockFlash / .4 * .65;
    }
    const portrait = this.camera.aspect < .8;
    this.camera.position.x += (game.playerX * (portrait ? .88 : .13) - this.camera.position.x) * (portrait ? .16 : .05);
    this.camera.lookAt(this.camera.position.x * (portrait ? .9 : .35), 0, -18);
    if (this.lastLabelTime === undefined || game.time < this.lastLabelTime || game.time - this.lastLabelTime >= 1 / 30 - .00001) {
      this.syncLabels(game);
      this.lastLabelTime = game.time;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
