import { Game } from './game.js';
import { View } from './render.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const stage = document.querySelector('.stage');
const overlay = $('overlay');
const startButton = $('start');
const pauseButton = $('pause');
const stressButton = $('stress');
const toast = $('toast');
let best = 0;
try { best = Number(localStorage.getItem('spacology-relay-next-best')) || 0; } catch (_) {}
let toastTimeout;

function showOverlay(mode, stats) {
  overlay.hidden = false;
  if (mode === 'paused') {
    $('overlayKicker').textContent = 'RUN PAUSED';
    $('overlayTitle').innerHTML = 'Hold your<br><i>line.</i>';
    $('overlayText').textContent = `Wave ${stats.wave} · ${stats.distance} m traveled. Resume when ready.`;
    startButton.innerHTML = 'RESUME RUN <span>↗</span>';
  } else if (mode === 'over') {
    $('overlayKicker').textContent = 'SIGNAL LOST';
    $('overlayTitle').innerHTML = 'One more<br><i>run?</i>';
    $('overlayText').textContent = `${stats.distance} m · wave ${stats.wave} · ${stats.kills} enemies defeated.`;
    startButton.innerHTML = 'RUN AGAIN <span>↗</span>';
  } else {
    $('overlayKicker').textContent = 'THE NEXT RELAY EXPERIMENT';
    $('overlayTitle').innerHTML = 'See what’s<br><i>coming.</i>';
    $('overlayText').textContent = 'Every shooter fights. Enemies that escape remove shooters. Recruit on the left and unlock stationary guns on the right.';
    startButton.innerHTML = 'START RUN <span>↗</span>';
  }
}

const game = new Game((type, detail, stats) => {
  if (type === 'toast') {
    toast.textContent = detail;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 1900);
  } else if (type === 'gameover') {
    if (stats.distance > best) {
      best = stats.distance;
      try { localStorage.setItem('spacology-relay-next-best', String(best)); } catch (_) {}
    }
    pauseButton.disabled = true;
    showOverlay('over', stats);
  } else if (type === 'phase') {
    overlay.hidden = stats.phase === 'running' || stats.phase === 'stress';
    pauseButton.disabled = stats.phase === 'stress';
    pauseButton.textContent = stats.phase === 'paused' ? '▶' : 'Ⅱ';
    pauseButton.setAttribute('aria-label', stats.phase === 'paused' ? 'Resume game' : 'Pause game');
    if (stats.phase === 'paused') showOverlay('paused', stats);
  }
});

let view;
try { view = new View(canvas, $('gateLabels')); }
catch (error) {
  $('overlayKicker').textContent = 'WEBGL2 UNAVAILABLE';
  $('overlayTitle').innerHTML = 'Renderer<br><i>unavailable.</i>';
  $('overlayText').textContent = 'This prototype needs a browser with WebGL2 enabled.';
  startButton.disabled = true;
  console.error(error);
}

const held = { left: false, right: false };
let dragging = false;
function steer(event) {
  const rect = canvas.getBoundingClientRect();
  game.steer(((event.clientX - rect.left) / rect.width - .5) * 15);
}
canvas.addEventListener('pointerdown', event => {
  if (game.phase !== 'running' && game.phase !== 'stress') return;
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
  steer(event);
});
canvas.addEventListener('pointermove', event => { if (dragging) steer(event); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
window.addEventListener('keydown', event => {
  if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') held.left = true;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') held.right = true;
  if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat) game.togglePause();
  if ((event.code === 'Enter' || event.code === 'Space') && game.phase !== 'running' && game.phase !== 'stress' && !event.repeat) startRun();
});
window.addEventListener('keyup', event => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') held.left = false;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') held.right = false;
});
window.addEventListener('blur', () => { held.left = held.right = false; dragging = false; if (game.phase === 'running') game.togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.phase === 'running') game.togglePause(); });
function resetFrameMetrics() {
  frameSamples.length = 0;
  frameP95 = 0;
  frameP99 = 0;
  qualityTime = 0;
  accumulator = 0;
  previous = performance.now();
}
async function startRun() {
  await view?.ready;
  if (game.phase !== 'paused') { view?.resetResolution(); resetFrameMetrics(); }
  game.start();
}
startButton.addEventListener('click', startRun);
pauseButton.addEventListener('click', () => game.togglePause());
stressButton.addEventListener('click', async () => {
  await view?.ready;
  if (game.phase === 'stress') {
    game.reset();
    view?.resetResolution();
    resetFrameMetrics();
    stressButton.innerHTML = 'RUN 8,000 ENTITY LOAD TEST <span>↗</span>';
    showOverlay('ready', game.stats());
  } else {
    view?.resetResolution();
    resetFrameMetrics();
    game.startStress();
    stressButton.innerHTML = 'EXIT LOAD TEST <span>×</span>';
  }
});

let previous = performance.now(), accumulator = 0, hudTime = 0, fpsTime = 0, fpsFrames = 0, fps = 0;
let qualityTime = 0, frameP95 = 0, frameP99 = 0;
const frameSamples = [];
const performanceState = { fps: 0, frameP95: 0, frameP99: 0, quality: 1 };
function frame(now) {
  const frameMs = now - previous;
  const elapsed = Math.min(.1, frameMs / 1000);
  previous = now;
  if ((game.phase === 'running' || game.phase === 'stress') && frameMs < 100) {
    frameSamples.push(frameMs);
    if (frameSamples.length > 240) frameSamples.shift();
  }
  accumulator += elapsed;
  while (accumulator >= 1 / 60) {
    game.update(1 / 60, Number(held.right) - Number(held.left));
    accumulator -= 1 / 60;
  }
  if (view) view.render(game);
  fpsFrames++;
  fpsTime += elapsed;
  if (fpsTime >= .6) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }
  qualityTime += elapsed;
  if (qualityTime >= 2 && frameSamples.length >= 30) {
    qualityTime = 0;
    const ordered = [...frameSamples].sort((a, b) => a - b);
    frameP95 = ordered[Math.floor((ordered.length - 1) * .95)];
    frameP99 = ordered[Math.floor((ordered.length - 1) * .99)];
    if (frameP95 > 17.2 && view && (game.phase === 'running' || game.phase === 'stress')) {
      if (view.lowerResolution()) frameSamples.length = 0;
    }
  }
  hudTime += elapsed;
  if (hudTime > .12) {
    hudTime = 0;
    const stats = game.stats();
    $('wave').textContent = String(Math.max(1, stats.wave)).padStart(2, '0');
    $('distance').innerHTML = `${stats.distance} <em>m</em>`;
    $('health').textContent = String(stats.squad);
    $('squadHealth').textContent = `${stats.squad} / ${stats.maxSquad}`;
    $('squadFill').style.width = `${stats.squad / stats.maxSquad * 100}%`;
    stage.classList.toggle('danger', stats.phase === 'running' && (stats.closeEnemies >= 5 || stats.squad <= Math.max(3, stats.maxSquad * .25)));
    $('enemyCount').textContent = stats.enemies.toLocaleString();
    $('squadCount').textContent = stats.squad.toLocaleString();
    $('gunStatus').textContent = `C${stats.cannonLevel} S${stats.shockLevel}`;
    $('escapedCount').textContent = stats.escaped.toLocaleString();
    $('bossCount').textContent = stats.bosses.toLocaleString();
    $('bulletCount').textContent = stats.bullets.toLocaleString();
    $('fps').textContent = fps || '—';
    $('frame95').textContent = frameP95 ? `${frameP95.toFixed(1)}ms` : '—';
    $('quality').textContent = view ? `${Math.round(view.pixelRatio / view.maxPixelRatio * 100)}%` : '—';
    $('best').textContent = `${best} m`;
    performanceState.fps = fps;
    performanceState.frameP95 = frameP95;
    performanceState.frameP99 = frameP99;
    performanceState.quality = view ? view.pixelRatio / view.maxPixelRatio : 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.relayRunner = { game, view, performance: performanceState };
