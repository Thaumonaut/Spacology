(() => {
  'use strict';

  const W = 420, H = 760, SHIP_Y = 635;
  const LANES = [86, 210, 334];
  const COLORS = { power: '#ffb778', rapid: '#75e3e0', split: '#d4abff', repair: '#9de4a1' };
  const LABELS = { power: 'POWER', rapid: 'RAPID', split: 'SPLIT', repair: 'HULL' };
  const DESCRIPTIONS = { power: '+1 damage', rapid: 'Faster fire', split: 'Extra shot', repair: '+1 hull' };
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayEyebrow = document.getElementById('overlayEyebrow');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const startButton = document.getElementById('startButton');
  const pauseButton = document.getElementById('pauseButton');
  const toastElement = document.getElementById('toast');
  const waveElement = document.getElementById('wave');
  const distanceElement = document.getElementById('distance');
  const hullElement = document.getElementById('hull');
  const bestElement = document.getElementById('best');
  const keys = { left: false, right: false };
  let dragging = false;
  let lastFrame = performance.now();
  let state;
  let best = 0;
  try { best = Math.max(0, Number(localStorage.getItem('spacology-relay-runner-best')) || 0); } catch (_) {}

  function freshState() {
    return {
      phase: 'ready', time: 0, distance: 0, wave: 0, kills: 0,
      hull: 3, maxHull: 3, invulnerable: 0,
      damage: 1, fireInterval: 0.31, shotTimer: 0, shots: 1,
      shipX: LANES[1], targetX: LANES[1], scroll: 0,
      segmentTimer: 0.7, nextGate: true, spawnQueue: [],
      gates: [], enemies: [], bullets: [], particles: [], labels: [],
      toastTime: 0, shake: 0
    };
  }
  state = freshState();

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function randomLane() { return Math.floor(Math.random() * 3); }
  function laneFor(x) { return Math.max(0, Math.min(2, Math.round((x - LANES[0]) / 124))); }
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  function roundRect(x, y, w, h, r, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function showToast(message) {
    toastElement.textContent = message;
    toastElement.classList.add('show');
    state.toastTime = 2.1;
  }
  function burst(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 45 + Math.random() * 150;
      state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .28 + Math.random() * .5, maxLife: .78, color, size: 1.5 + Math.random() * 3 });
    }
  }
  function floating(text, x, y, color) {
    state.labels.push({ text, x, y, life: 1, color });
  }
  function updateHud() {
    waveElement.textContent = String(Math.max(1, state.wave)).padStart(2, '0');
    distanceElement.innerHTML = `${Math.floor(state.distance)} <small>m</small>`;
    hullElement.textContent = '◆ '.repeat(state.hull).trim() + (state.hull < state.maxHull ? ' ◇'.repeat(state.maxHull - state.hull) : '');
    bestElement.innerHTML = `${best} <small>m</small>`;
  }

  function showOverlay(mode) {
    overlay.hidden = false;
    if (mode === 'paused') {
      overlayEyebrow.textContent = 'RUN INTERRUPTED';
      overlayTitle.innerHTML = 'Hold<br><em>position.</em>';
      overlayText.textContent = `Wave ${state.wave} · ${Math.floor(state.distance)} m. Your ship is safe while paused.`;
      startButton.innerHTML = 'RESUME RUN <span>↗</span>';
    } else if (mode === 'over') {
      overlayEyebrow.textContent = 'SIGNAL LOST';
      overlayTitle.innerHTML = 'Run<br><em>complete.</em>';
      overlayText.textContent = `${Math.floor(state.distance)} m traveled · wave ${state.wave} reached · ${state.kills} enemies cleared. The next run starts fresh.`;
      startButton.innerHTML = 'RUN AGAIN <span>↗</span>';
    }
  }
  function begin() {
    if (state.phase !== 'paused') state = freshState();
    state.phase = 'running';
    overlay.hidden = true;
    pauseButton.disabled = false;
    pauseButton.textContent = 'Ⅱ';
    pauseButton.setAttribute('aria-label', 'Pause game');
    lastFrame = performance.now();
    updateHud();
  }
  function pause() {
    if (state.phase === 'running') {
      state.phase = 'paused';
      pauseButton.textContent = '▶';
      pauseButton.setAttribute('aria-label', 'Resume game');
      showOverlay('paused');
    } else if (state.phase === 'paused') begin();
  }
  function endRun() {
    state.phase = 'over';
    pauseButton.disabled = true;
    const score = Math.floor(state.distance);
    if (score > best) {
      best = score;
      try { localStorage.setItem('spacology-relay-runner-best', String(best)); } catch (_) {}
    }
    updateHud();
    showOverlay('over');
  }
  function hitShip() {
    if (state.invulnerable > 0 || state.phase !== 'running') return;
    state.hull--;
    state.invulnerable = 1.15;
    state.shake = 8;
    burst(state.shipX, SHIP_Y, '#ff8d86', 22);
    showToast(state.hull ? 'HULL HIT' : 'HULL BREACHED');
    updateHud();
    if (state.hull <= 0) endRun();
  }
  function applyUpgrade(type) {
    if (type === 'power') state.damage++;
    if (type === 'rapid') state.fireInterval = Math.max(.085, state.fireInterval * .85);
    if (type === 'split') state.shots = Math.min(5, state.shots + 1);
    if (type === 'repair') { state.maxHull = Math.min(7, state.maxHull + 1); state.hull = Math.min(state.maxHull, state.hull + 1); }
    const level = type === 'power' ? state.damage : type === 'split' ? state.shots : null;
    showToast(`${LABELS[type]} ${level ? `LV ${level}` : 'UP'}`);
    burst(state.shipX, SHIP_Y - 22, COLORS[type], 25);
    updateHud();
  }

  function spawnGate() {
    const types = shuffle(['power', 'rapid', 'split', 'repair']).slice(0, 3);
    state.gates.push({
      y: -45, resolved: false,
      cells: types.map((type, lane) => {
        const base = type === 'split' ? 8 : type === 'repair' ? 6 : 5;
        const hp = base + Math.floor(state.wave * .85);
        return { type, lane, hp, maxHp: hp, open: false };
      })
    });
  }
  function spawnWave() {
    state.wave++;
    showToast(`WAVE ${String(state.wave).padStart(2, '0')} INCOMING`);
    const count = Math.min(3 + Math.floor(state.wave * .8), 12);
    const start = state.time;
    for (let i = 0; i < count; i++) {
      const kind = state.wave % 5 === 0 && i === count - 1 ? 'boss' :
        state.wave >= 3 && i % 4 === 3 ? 'brute' : i % 3 === 2 ? 'skimmer' : 'drone';
      state.spawnQueue.push({ at: start + i * (state.wave >= 6 ? .44 : .64), lane: randomLane(), kind, wave: state.wave });
    }
    updateHud();
  }
  function addEnemy(entry) {
    const hp = Math.ceil((entry.kind === 'boss' ? 15 : entry.kind === 'brute' ? 6 : 3) * (1 + (entry.wave - 1) * .22));
    state.enemies.push({ lane: entry.lane, kind: entry.kind, x: LANES[entry.lane], y: -32, hp, maxHp: hp, phase: Math.random() * 6, speed: entry.kind === 'skimmer' ? 1.24 : entry.kind === 'boss' ? .72 : 1 });
  }
  function fire() {
    const n = state.shots;
    for (let i = 0; i < n; i++) {
      const offset = (i - (n - 1) / 2) * 15;
      state.bullets.push({ x: state.shipX + offset, y: SHIP_Y - 27, vx: offset * .9, vy: -640, damage: state.damage });
    }
  }

  function update(dt) {
    state.time += dt;
    const roadSpeed = Math.min(285, 170 + state.wave * 5);
    state.distance += roadSpeed * dt / 10;
    state.scroll = (state.scroll + roadSpeed * dt) % 70;
    state.invulnerable = Math.max(0, state.invulnerable - dt);
    state.shake = Math.max(0, state.shake - dt * 23);
    if (state.toastTime > 0 && (state.toastTime -= dt) <= 0) toastElement.classList.remove('show');

    if (keys.left) state.targetX -= 325 * dt;
    if (keys.right) state.targetX += 325 * dt;
    state.targetX = Math.max(39, Math.min(381, state.targetX));
    state.shipX += (state.targetX - state.shipX) * Math.min(1, dt * 14);

    state.segmentTimer -= dt;
    if (state.segmentTimer <= 0) {
      if (state.nextGate) spawnGate(); else spawnWave();
      state.segmentTimer += state.nextGate ? 6.0 : Math.max(6.1, 8.0 - state.wave * .13);
      state.nextGate = !state.nextGate;
    }
    for (let i = state.spawnQueue.length - 1; i >= 0; i--) {
      if (state.spawnQueue[i].at <= state.time) addEnemy(state.spawnQueue.splice(i, 1)[0]);
    }
    state.shotTimer -= dt;
    while (state.shotTimer <= 0) { fire(); state.shotTimer += state.fireInterval; }

    for (const row of state.gates) {
      row.y += roadSpeed * dt;
      if (!row.resolved && row.y >= SHIP_Y - 3) {
        row.resolved = true;
        const gate = row.cells[laneFor(state.shipX)];
        if (gate.open) applyUpgrade(gate.type); else hitShip();
      }
    }
    state.gates = state.gates.filter(row => row.y < H + 60);

    for (const enemy of state.enemies) {
      enemy.y += roadSpeed * enemy.speed * dt;
      if (enemy.kind === 'skimmer') enemy.x = LANES[enemy.lane] + Math.sin(state.time * 5 + enemy.phase) * 22;
      if (Math.abs(enemy.x - state.shipX) < (enemy.kind === 'boss' ? 40 : 29) && Math.abs(enemy.y - SHIP_Y) < 29) {
        enemy.y = H + 100;
        hitShip();
      }
    }
    state.enemies = state.enemies.filter(enemy => enemy.y < H + 50 && enemy.hp > 0);

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      let spent = bullet.y < -30 || bullet.x < 0 || bullet.x > W;
      if (!spent) {
        for (const row of state.gates) {
          if (row.resolved || Math.abs(bullet.y - row.y) > 31) continue;
          const gate = row.cells.find(cell => !cell.open && Math.abs(bullet.x - LANES[cell.lane]) < 53);
          if (gate) {
            gate.hp -= bullet.damage;
            spent = true;
            burst(bullet.x, bullet.y, COLORS[gate.type], 3);
            if (gate.hp <= 0) {
              gate.open = true;
              burst(LANES[gate.lane], row.y, COLORS[gate.type], 19);
              floating('OPEN', LANES[gate.lane], row.y - 15, COLORS[gate.type]);
            }
            break;
          }
        }
      }
      if (!spent) {
        for (const enemy of state.enemies) {
          const radius = enemy.kind === 'boss' ? 35 : enemy.kind === 'brute' ? 27 : 20;
          if (Math.abs(bullet.x - enemy.x) < radius && Math.abs(bullet.y - enemy.y) < radius) {
            enemy.hp -= bullet.damage;
            spent = true;
            burst(bullet.x, bullet.y, '#ff9a8a', 3);
            if (enemy.hp <= 0) {
              state.kills++;
              burst(enemy.x, enemy.y, enemy.kind === 'boss' ? '#f7ca82' : '#ff877b', enemy.kind === 'boss' ? 35 : 16);
              floating(enemy.kind === 'boss' ? 'ELITE DOWN' : '+10', enemy.x, enemy.y, '#f7d095');
            }
            break;
          }
        }
      }
      if (spent) state.bullets.splice(i, 1);
    }
    state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= .97;
      particle.vy *= .97;
      particle.life -= dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);
    for (const label of state.labels) { label.y -= 35 * dt; label.life -= dt; }
    state.labels = state.labels.filter(l => l.life > 0);
    updateHud();
  }

  function drawRoad() {
    const background = ctx.createLinearGradient(0, 0, 0, H);
    background.addColorStop(0, '#091322'); background.addColorStop(1, '#13263a');
    ctx.fillStyle = background; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0c1c2c'; ctx.fillRect(24, 0, 372, H);
    for (let i = 0; i < 12; i++) {
      const y = ((i * 97 + state.scroll * 1.6) % (H + 110)) - 80;
      const x = i % 2 === 0 ? 10 : 408;
      ctx.fillStyle = '#366078'; ctx.globalAlpha = .2 + (y / H) * .3;
      ctx.fillRect(x, y, 2, 16);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#2e6680'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(24, H); ctx.moveTo(396, 0); ctx.lineTo(396, H); ctx.stroke();
    ctx.strokeStyle = '#35556c'; ctx.lineWidth = 1;
    ctx.setLineDash([18, 26]); ctx.lineDashOffset = -state.scroll;
    ctx.beginPath(); ctx.moveTo(148, 0); ctx.lineTo(148, H); ctx.moveTo(272, 0); ctx.lineTo(272, H); ctx.stroke();
    ctx.setLineDash([]);
    for (let y = state.scroll - 70; y < H; y += 70) {
      ctx.fillStyle = 'rgba(95,177,196,.085)'; ctx.fillRect(25, y, 370, 1);
    }
    const glow = ctx.createRadialGradient(state.shipX, SHIP_Y, 10, state.shipX, SHIP_Y, 145);
    glow.addColorStop(0, '#51e6df20'); glow.addColorStop(1, '#51e6df00');
    ctx.fillStyle = glow; ctx.fillRect(0, 470, W, 290);
  }
  function drawGate(row) {
    for (const cell of row.cells) {
      const x = LANES[cell.lane] - 54, y = row.y - 29, color = COLORS[cell.type];
      if (cell.open) {
        roundRect(x, y, 108, 58, 8, '#122a2b44', color + '88', 1.5);
        ctx.fillStyle = color; ctx.globalAlpha = .45; ctx.font = '700 10px Space Grotesk, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('OPEN', x + 54, y + 34); ctx.globalAlpha = 1;
      } else {
        ctx.shadowColor = color; ctx.shadowBlur = 15;
        roundRect(x, y, 108, 58, 7, '#142434', color, 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = color; ctx.textAlign = 'center';
        ctx.font = '700 12px Space Grotesk, sans-serif'; ctx.fillText(LABELS[cell.type], x + 54, y + 20);
        ctx.fillStyle = '#d7e6ed'; ctx.font = '600 9px DM Sans, sans-serif'; ctx.fillText(DESCRIPTIONS[cell.type], x + 54, y + 34);
        roundRect(x + 13, y + 44, 82, 5, 3, '#334758');
        roundRect(x + 13, y + 44, 82 * Math.max(0, cell.hp / cell.maxHp), 5, 3, color);
      }
    }
  }
  function drawEnemy(enemy) {
    ctx.save(); ctx.translate(enemy.x, enemy.y);
    const scale = enemy.kind === 'boss' ? 1.5 : enemy.kind === 'brute' ? 1.25 : 1;
    ctx.scale(scale, scale);
    const color = enemy.kind === 'boss' ? '#f7ca82' : enemy.kind === 'brute' ? '#ff9c78' : '#ff757f';
    ctx.shadowColor = color; ctx.shadowBlur = enemy.kind === 'boss' ? 20 : 10;
    ctx.fillStyle = '#482c3b'; ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 19); ctx.lineTo(-21, -10); ctx.lineTo(-11, -19); ctx.lineTo(11, -19); ctx.lineTo(21, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = color;
    ctx.fillRect(-17, -5, 7, 3); ctx.fillRect(10, -5, 7, 3);
    if (enemy.kind !== 'drone') { ctx.beginPath(); ctx.moveTo(-18, -10); ctx.lineTo(-28, -20); ctx.moveTo(18, -10); ctx.lineTo(28, -20); ctx.stroke(); }
    ctx.restore();
    const width = enemy.kind === 'boss' ? 68 : 40;
    roundRect(enemy.x - width / 2, enemy.y - (enemy.kind === 'boss' ? 43 : 31), width, 4, 2, '#455064');
    roundRect(enemy.x - width / 2, enemy.y - (enemy.kind === 'boss' ? 43 : 31), width * Math.max(0, enemy.hp / enemy.maxHp), 4, 2, color);
  }
  function drawShip() {
    if (state.invulnerable > 0 && Math.floor(state.time * 12) % 2) ctx.globalAlpha = .42;
    ctx.save(); ctx.translate(state.shipX, SHIP_Y);
    ctx.fillStyle = '#6be8e3'; ctx.shadowColor = '#62e7e4'; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(-12, 2); ctx.lineTo(-27, 14); ctx.lineTo(-22, 23); ctx.lineTo(0, 12); ctx.lineTo(22, 23); ctx.lineTo(27, 14); ctx.lineTo(12, 2); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#143a49';
    ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(-6, 7); ctx.lineTo(0, 3); ctx.lineTo(6, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f8d28e'; ctx.fillRect(-14, 20, 6, 11 + Math.sin(state.time * 30) * 4); ctx.fillRect(8, 20, 6, 11 + Math.cos(state.time * 30) * 4);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.save();
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    if (state.shake > 0) ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);
    drawRoad();
    for (const row of state.gates) drawGate(row);
    for (const enemy of state.enemies) drawEnemy(enemy);
    for (const bullet of state.bullets) {
      ctx.shadowColor = '#a0fffb'; ctx.shadowBlur = 10; roundRect(bullet.x - 2, bullet.y - 12, 4, 17, 2, '#bafffa'); ctx.shadowBlur = 0;
    }
    if (state.phase === 'running' || state.phase === 'paused' || state.phase === 'over') drawShip();
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.min(1, particle.life / .35); ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
    for (const label of state.labels) {
      ctx.globalAlpha = label.life; ctx.fillStyle = label.color; ctx.textAlign = 'center';
      ctx.font = '700 12px Space Grotesk, sans-serif'; ctx.fillText(label.text, label.x, label.y);
    }
    ctx.globalAlpha = 1; ctx.restore();
  }
  function frame(now) {
    const dt = Math.min((now - lastFrame) / 1000, .05);
    lastFrame = now;
    if (state.phase === 'running') update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function steer(event) {
    const rect = canvas.getBoundingClientRect();
    state.targetX = Math.max(39, Math.min(381, (event.clientX - rect.left) / rect.width * W));
  }
  canvas.addEventListener('pointerdown', event => {
    if (state.phase !== 'running') return;
    dragging = true; canvas.setPointerCapture(event.pointerId); steer(event);
  });
  canvas.addEventListener('pointermove', event => { if (dragging) steer(event); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  window.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') keys.left = true;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') keys.right = true;
    if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat) pause();
    if ((event.code === 'Enter' || event.code === 'Space') && state.phase !== 'running' && !event.repeat) begin();
  });
  window.addEventListener('keyup', event => {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') keys.left = false;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') keys.right = false;
  });
  window.addEventListener('blur', () => { keys.left = keys.right = false; dragging = false; if (state.phase === 'running') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.phase === 'running') pause(); });
  startButton.addEventListener('click', begin);
  pauseButton.addEventListener('click', pause);
  updateHud();
  requestAnimationFrame(frame);
})();
