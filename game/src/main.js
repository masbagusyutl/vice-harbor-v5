// Vice Harbor — boot, input, HUD and the one loop.
// ?shot=title|chase|night|pause (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a
// screenshot. Otherwise the game runs: title, play, paused, busted.
import {
  createGame, stepGame, startJob, chooseOption, wantedStars, respectRank,
  percentComplete, saveData, loadSave, currentJob, currentStep, SAVE_KEY,
  RESPECT_RANKS, CREW, RACES, PITCH, CITY_W, CITY_H, WATER_Z, STEP, dist,
} from './sim.js';
import {
  createRenderer, buildCityMeshes, buildActors, drawFrame, chaseCamera,
} from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261121;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const hud = document.getElementById('hud');
const cashEl = document.getElementById('cash');
const rankEl = document.getElementById('rank');
const starsEl = document.getElementById('stars');
const timeEl = document.getElementById('time');
const completeEl = document.getElementById('complete');
const objectiveEl = document.getElementById('objective');
const dialogueEl = document.getElementById('dialogue');
const standingsEl = document.getElementById('standings');
const toastEl = document.getElementById('toast');
const minimap = document.getElementById('minimap');
const titleEl = document.getElementById('title');
const pauseEl = document.getElementById('pause');
const overEl = document.getElementById('over');
const pauseStats = document.getElementById('pause-stats');
const overTitle = document.getElementById('over-title');
const overText = document.getElementById('over-text');

const audio = createAudio();
let muted = false;

const state = createGame(seed);
const renderer = createRenderer(canvas);
buildCityMeshes(renderer, state);
const actors = buildActors(renderer, state);

let screen = 'title';
let lastLogSeen = 0;
let toastTimer = 0;

function fmtTime(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveData(state)));
  } catch { /* storage can be off; the run lasts this visit only */ }
}

function showOnly(el) {
  for (const other of [titleEl, pauseEl, overEl]) other.classList.toggle('hidden', other !== el);
  hud.classList.toggle('hidden', el === titleEl);
}

function announce(message) { status.textContent = message; }

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  toastTimer = 3;
}

function updateHud() {
  const p = state.player;
  cashEl.textContent = `$${p.cash}`;
  rankEl.textContent = RESPECT_RANKS[respectRank(state)];
  const stars = wantedStars(state);
  starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  starsEl.classList.toggle('hot', stars >= 3);
  timeEl.textContent = fmtTime(state.time);
  completeEl.textContent = `${percentComplete(state)}% COMPLETE`;
  const job = currentJob(state);
  const step = currentStep(state);
  if (state.jobState === 'active' && job && step) {
    objectiveEl.innerHTML = `<b>${job.title}</b> — ${job.giver}<br>${step.text}`;
  } else if (job) {
    objectiveEl.innerHTML = `<b>${job.title}</b> — press <b>F</b> to start the job`;
  } else {
    objectiveEl.innerHTML = 'All jobs done. Vice Harbor is yours, Marco.';
  }
  if (state.log.length > lastLogSeen) {
    const line = state.log[state.log.length - 1];
    dialogueEl.textContent = line;
    dialogueEl.classList.remove('hidden');
    lastLogSeen = state.log.length;
  }
  if (state.race) {
    const r = state.race;
    const playerPlace = r.index > r.rivalIndex ? 1 : 2;
    standingsEl.innerHTML = `<b>${r.name}</b><br>${playerPlace}. YOU<br>${playerPlace === 1 ? 2 : 1}. ${r.rival.toUpperCase()}<br>Checkpoint ${Math.min(r.index + 1, r.checkpoints.length)}/${r.checkpoints.length}`;
    standingsEl.classList.remove('hidden');
  } else {
    standingsEl.classList.add('hidden');
  }
  drawMinimap();
}

function drawMinimap() {
  const g = minimap.getContext('2d');
  const W = minimap.width; const H = minimap.height;
  const sx = W / CITY_W; const sz = H / (CITY_H + 40);
  g.fillStyle = 'rgba(12,14,20,0.85)';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#5a6270';
  g.lineWidth = 2;
  for (let i = 0; i <= 5; i += 1) {
    g.beginPath(); g.moveTo(i * PITCH * sx, 0); g.lineTo(i * PITCH * sx, CITY_H * sz); g.stroke();
  }
  for (let j = 0; j <= 2; j += 1) {
    g.beginPath(); g.moveTo(0, j * PITCH * sz); g.lineTo(CITY_W * sx, j * PITCH * sz); g.stroke();
  }
  g.fillStyle = '#0e3d4e';
  g.fillRect(0, CITY_H * sz, W, 40 * sz);
  const step = currentStep(state);
  if (state.jobState === 'active' && step && step.at) {
    g.fillStyle = '#ffd94d';
    g.beginPath(); g.arc(step.at[0] * sx, step.at[1] * sz, 5, 0, Math.PI * 2); g.fill();
  }
  if (state.taxi && !state.taxi.picked) {
    g.fillStyle = '#59e389';
    g.beginPath(); g.arc(state.taxi.x * sx, state.taxi.z * sz, 4, 0, Math.PI * 2); g.fill();
  }
  for (const cop of state.police) {
    g.fillStyle = '#4d7dff';
    g.beginPath(); g.arc(cop.x * sx, cop.z * sz, 3, 0, Math.PI * 2); g.fill();
  }
  const p = state.player;
  g.save();
  g.translate(p.x * sx, p.z * sz);
  // The arrow is drawn pointing up; rotate it so it points along the
  // player's heading, where +z is down on the map.
  g.rotate(Math.PI - p.heading);
  g.fillStyle = '#19d3e6';
  g.beginPath();
  g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath();
  g.fill();
  g.restore();
}

function runShot(name) {
  const staged = stageShot(name);
  const stagedState = staged.state;
  // Swap the live state for the staged one (same shape, real sim data).
  Object.keys(state).forEach((k) => { state[k] = stagedState[k]; });
  state.time = stagedState.time;
  lastLogSeen = state.log.length;
  if (staged.dialogue) {
    dialogueEl.textContent = staged.dialogue;
    dialogueEl.classList.remove('hidden');
  }
  showOnly(staged.screen === 'title' ? titleEl : staged.screen === 'paused' ? pauseEl : null);
  if (staged.screen === 'paused') {
    pauseStats.innerHTML = pauseStatsHtml();
  }
  updateHud();
  let painted = 0;
  function paint() {
    drawFrame(renderer, actors, state, staged.camera);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function pauseStatsHtml() {
  const s = state.stats;
  return [
    `<b>${percentComplete(state)}% COMPLETE</b>`,
    `Cash $${state.player.cash} · Respect ${RESPECT_RANKS[respectRank(state)]}`,
    `Jobs ${state.jobsDone.length}/7 · Races won ${state.raceWon.length}/3`,
    `Harbor tokens ${s.tokens}/24 · Turf ${state.turf.filter((t) => t.owned).length}/4`,
    `Crew ${state.crew.length}/3 · Fares ${s.fares} · Cars stolen ${s.carsStolen}`,
  ].join('<br>');
}

function startGame() {
  const save = readSave();
  if (save) loadSave(state, save);
  screen = 'play';
  showOnly(null);
  announce('Playing. Vice Harbor.');
}

function pauseGame() {
  screen = 'paused';
  pauseStats.innerHTML = pauseStatsHtml();
  showOnly(pauseEl);
  writeSave();
  announce('Paused.');
}

function resumeGame() {
  screen = 'play';
  showOnly(null);
  announce('Playing.');
}

function endGame(busted) {
  screen = 'over';
  overTitle.textContent = busted ? 'BUSTED' : 'WASTED';
  overText.textContent = busted
    ? 'The Vice Harbor police took $100 and dropped you back at Neon Row.'
    : 'Marco is down. The city keeps moving without you.';
  showOnly(overEl);
  writeSave();
  announce(`${overTitle.textContent}. Press Enter to keep playing.`);
}

const keys = {};
const input = { forward: false, back: false, left: false, right: false };

function readInput() {
  input.forward = !!(keys.KeyW || keys.ArrowUp);
  input.back = !!(keys.KeyS || keys.ArrowDown);
  input.left = !!(keys.KeyA || keys.ArrowLeft);
  input.right = !!(keys.KeyD || keys.ArrowRight);
  return input;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'KeyM') { muted = !muted; audio.setMuted(muted); }
  if (screen === 'title' && (e.code === 'Enter' || e.code === 'Space')) { startGame(); return; }
  if (screen === 'over' && (e.code === 'Enter' || e.code === 'Space')) { startGame(); return; }
  if ((e.code === 'KeyP' || e.code === 'Escape') && screen === 'play') { pauseGame(); return; }
  if ((e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Enter') && screen === 'paused') { resumeGame(); return; }
  if (e.code === 'KeyF' && screen === 'play') {
    const job = currentJob(state);
    if (job && state.jobState === 'idle') startJob(state, state.jobIndex);
    else stepGame(state, { interact: true });
  }
  if (e.code === 'KeyE' && screen === 'play') stepGame(state, { enter: true });
  if ((e.code === 'Digit1' || e.code === 'Digit2') && screen === 'play') {
    chooseOption(state, e.code === 'Digit1' ? 0 : 1);
  }
  if (e.code === 'Space') e.preventDefault();
});

window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousedown', () => {
  if (screen === 'play') stepGame(state, { shoot: true });
  audio.unlock();
});
canvas.addEventListener('click', () => {
  if (screen === 'title') startGame();
});

function frame(now) {
  requestAnimationFrame(frame);
  if (screen !== 'play') {
    // The title screen idles the world behind it; pause freezes it.
    if (screen === 'title') {
      stepGame(state, {}, STEP);
      drawFrame(renderer, actors, state, {
        x: 285, y: 34, z: -95, lookX: 285, lookY: 6, lookZ: 130, fov: 55,
      });
    }
    return;
  }
  const inp = readInput();
  const before = state.jobsDone.length;
  stepGame(state, { ...inp, shoot: !!keys.Space });
  if (state.jobsDone.length > before) {
    const job = state.jobsDone[state.jobsDone.length - 1];
    toast(`JOB COMPLETE — ${job}`);
    writeSave();
  }
  if (state.player.health <= 0) { endGame(false); return; }
  if (toastTimer > 0) {
    toastTimer -= STEP;
    if (toastTimer <= 0) toastEl.classList.add('hidden');
  }
  audio.update(state, muted);
  updateHud();
  const distance = state.player.car ? 13 : 9;
  drawFrame(renderer, actors, state, chaseCamera(state, distance, state.player.car ? 6.5 : 5, 58));
}

if (shotName) {
  runShot(shotName);
} else {
  const save = readSave();
  if (save) {
    document.getElementById('continue-line').textContent =
      `Continue — ${save.percent}% complete, $${save.cash} in hand. Press Enter.`;
  }
  showOnly(titleEl);
  announce('Vice Harbor. Press Enter or click to start.');
  requestAnimationFrame(frame);
}
