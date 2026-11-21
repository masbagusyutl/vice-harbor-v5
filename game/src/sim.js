// Vice Harbor — pure game logic (no DOM, no WebGL, no three.js).
// Runs in the browser and in Node for the headless playthrough check.
// Everything is deterministic for a fixed seed: same inputs, same world.
//
// The game: an original 3D open-world harbor-city crime game. The player
// (Marco Solano) works jobs for a small crew across 10 districts, drives,
// steals cars, dodges the police, races rivals, runs a boat in the harbor,
// collects hidden tokens, takes turf and builds respect.

export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STEP = 1 / 60;
export const BLOCK = 96;          // size of one city block (a district)
export const ROAD = 18;           // width of the roads between blocks
export const PITCH = BLOCK + ROAD; // distance between neighbouring intersections
export const COLS = 5;
export const ROWS = 2;
export const CITY_W = COLS * PITCH;
export const CITY_H = ROWS * PITCH;
export const WATER_Z = CITY_H + 46; // the harbor water starts here (south edge)

export const DISTRICTS = [
  { name: 'Port Azura',   col: 0, row: 0, palette: '#c96f2e', neon: '#ff9a3d', sign: 'PORT AZURA' },
  { name: 'Neon Row',     col: 1, row: 0, palette: '#7a3fd1', neon: '#e04df0', sign: 'NEON ROW' },
  { name: 'Calle Verde',  col: 2, row: 0, palette: '#3f7d4e', neon: '#59e389', sign: 'CALLE VERDE' },
  { name: 'The Docks',    col: 3, row: 0, palette: '#5a6b7a', neon: '#7fd4ff', sign: 'THE DOCKS' },
  { name: 'Marina Bay',   col: 4, row: 0, palette: '#2e6f8f', neon: '#4dd7ff', sign: 'MARINA BAY' },
  { name: 'Old Foundry',  col: 0, row: 1, palette: '#8a5a3b', neon: '#ffb347', sign: 'OLD FOUNDRY' },
  { name: 'Palm Court',   col: 1, row: 1, palette: '#b08a2e', neon: '#ffd94d', sign: 'PALM COURT' },
  { name: 'Ironworks',    col: 2, row: 1, palette: '#6b6f75', neon: '#c9d4ff', sign: 'IRONWORKS' },
  { name: 'Sunset Strip', col: 3, row: 1, palette: '#c94f5e', neon: '#ff5e7a', sign: 'SUNSET STRIP' },
  { name: 'Coral Heights',col: 4, row: 1, palette: '#3f8f7d', neon: '#4dffe0', sign: 'CORAL HEIGHTS' },
];

export const RESPECT_RANKS = ['Rookie', 'Runner', 'Hustler', 'Fixer', 'Kingpin'];
export const CREW = [
  { id: 'marisol', name: 'Marisol Vega', role: 'Getaway driver', bonus: 'Cars handle 15% better' },
  { id: 'sam', name: 'Sam "Wrench" Okafor', role: 'Mechanic', bonus: 'Respray and repairs half price' },
  { id: 'lena', name: 'Lena Cross', role: 'Hacker', bonus: 'Wanted heat fades twice as fast' },
];
export const RIVALS = [
  { id: 'roxy', name: 'Roxy Rook', car: 'Vandal GT', color: '#ff3d6e' },
  { id: 'diego', name: 'Diego Flint', car: 'Bravado S', color: '#ffb03d' },
  { id: 'mira', name: 'Mira Solace', car: 'Nebula R', color: '#b04dff' },
];

// A job is a short chain of steps. Step types:
// goto (reach a marker), pickup (stand at a marker), steal (enter a named car),
// deliver (drive the named car to a marker), boat (collect crates on the water),
// race (beat a rival around checkpoints), turf (hold two markers), escape (reach
// a marker while wanted), choice (a branching decision, resolved by the player).
export const JOBS = [
  {
    id: 'job1', title: 'First Light', giver: 'Marisol Vega', reward: 150,
    intro: 'Marisol: "Marco, a package is waiting on the Marina Bay dock. Bring it back and nobody gets hurt."',
    outro: 'Marisol: "Clean. You drive like you mean it. We are going to get along."',
    steps: [
      { type: 'goto', at: [5 * PITCH, WATER_Z - 8], text: 'Drive to Marina Bay dock' },
      { type: 'pickup', at: [5 * PITCH, WATER_Z - 8], text: 'Pick up the package' },
      { type: 'goto', at: [1 * PITCH, 0], text: 'Bring it back to Marisol at Neon Row' },
    ],
  },
  {
    id: 'job2', title: 'Night Shift', giver: 'Lena Cross', reward: 220,
    intro: 'Lena: "A fare needs a lift from Neon Row to Palm Court. No questions, no shortcuts through a roadblock."',
    outro: 'Lena: "Fare paid, no tail. You are hired — I run the crew\'s eyes and ears from here on."',
    steps: [
      { type: 'goto', at: [1 * PITCH, 0], text: 'Pick up the fare at Neon Row' },
      { type: 'deliver', at: [1 * PITCH, 2 * PITCH], text: 'Drop the fare at Palm Court' },
    ],
  },
  {
    id: 'job3', title: 'Hot Wheels', giver: 'Sam "Wrench" Okafor', reward: 300,
    intro: 'Sam: "A Comet GT is parked on the Strip. Lift it, bring it to my garage in the Foundry. Your call what happens next."',
    outro: 'Sam: "She purrs. You just bought yourself a mechanic — and a friend."',
    steps: [
      { type: 'steal', at: [3 * PITCH + 30, 1 * PITCH], car: 'Comet GT', text: 'Steal the Comet GT on Sunset Strip' },
      { type: 'deliver', at: [0, 2 * PITCH], car: 'Comet GT', text: 'Deliver it to Sam\'s garage' },
      { type: 'choice', text: 'Sam offers: deliver it intact ($300) or strip it for parts ($450, +1 wanted star)', options: ['Deliver it intact', 'Strip it for parts'] },
    ],
  },
  {
    id: 'job4', title: 'Tide Runner', giver: 'Captain Hale', reward: 400,
    intro: 'Captain Hale: "Three crates went overboard in the harbor. Take my skiff, fish them out, keep it quiet."',
    outro: 'Captain Hale: "Not a drop spilled. The harbor is yours whenever you need it, Marco."',
    steps: [
      { type: 'goto', at: [4.5 * PITCH, WATER_Z - 8], text: 'Board the skiff at the marina' },
      { type: 'boat', at: [2.0 * PITCH, WATER_Z + 55], text: 'Collect the 3 crates in the harbor' },
    ],
  },
  {
    id: 'job5', title: 'Sunset Sprint', giver: 'Marisol Vega', reward: 500,
    intro: 'Marisol: "Roxy Rook says nobody outruns her on the Strip. Prove her wrong — sunset, three checkpoints, winner takes the pot."',
    outro: 'Marisol: "Roxy is eating your dust. The Strip has a new name to fear."',
    steps: [{ type: 'race', race: 'sunset', text: 'Beat Roxy Rook in the Sunset Sprint' }],
  },
  {
    id: 'job6', title: 'Turf War', giver: 'Big Lou', reward: 600,
    intro: 'Big Lou: "Two corners on the Strip fly the wrong flag. Stand on them, hold them, and make it stick."',
    outro: 'Big Lou: "The Strip is ours. You just earned your corner of this city, Marco."',
    steps: [
      { type: 'turf', at: [4 * PITCH, 1 * PITCH], text: 'Hold the north corner of Sunset Strip' },
      { type: 'turf', at: [4 * PITCH, 2 * PITCH], text: 'Hold the south corner of Sunset Strip' },
    ],
  },
  {
    id: 'job7', title: 'The Last Ferry', giver: 'Marisol Vega', reward: 800,
    intro: 'Marisol: "Four stars, Marco, and the ferry leaves at dawn. Get to Port Azura — pay them off or outrun them, your call."',
    outro: 'Marisol: "You made it. Whatever comes next, we face it together."',
    steps: [
      { type: 'escape', at: [0, 0], text: 'Reach the Port Azura ferry with 4 wanted stars' },
      { type: 'choice', text: 'At the ferry: pay the $500 harbor bribe or slip aboard unseen', options: ['Pay the $500 bribe', 'Slip aboard unseen'] },
    ],
  },
];

export const RACES = [
  { id: 'sunset', name: 'Sunset Sprint', rival: 0, prize: 500, checkpoints: [[3 * PITCH, 2 * PITCH], [5 * PITCH, 2 * PITCH], [5 * PITCH, 0], [3 * PITCH, 0]] },
  { id: 'neon', name: 'Neon Loop', rival: 1, prize: 650, checkpoints: [[1 * PITCH, 0], [3 * PITCH, 0], [3 * PITCH, 2 * PITCH], [1 * PITCH, 2 * PITCH]] },
  { id: 'harbor', name: 'Harbor Grand Prix', rival: 2, prize: 800, checkpoints: [[0, 0], [5 * PITCH, 0], [5 * PITCH, 2 * PITCH], [0, 2 * PITCH]] },
];

export const TURF_ZONES = [
  { id: 'turf-n', name: 'Strip North', at: [4 * PITCH, 1 * PITCH] },
  { id: 'turf-s', name: 'Strip South', at: [4 * PITCH, 2 * PITCH] },
  { id: 'turf-w', name: 'Foundry West', at: [0, 2 * PITCH] },
  { id: 'turf-e', name: 'Marina East', at: [5 * PITCH, 0] },
];

export const GUN_SHOP = { at: [2 * PITCH, 2 * PITCH], name: "Lou's Guns", pistol: 200, ammo: 40 };
export const RESPRAY_SHOP = { at: [0, 2 * PITCH], name: "Wrench's Garage", price: 100 };
export const FERRY = { at: [0, 0], name: 'Port Azura Ferry' };
export const SAVE_KEY = 'vice-harbor-save-v5';

const TAU = Math.PI * 2;
export function dist(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

// Breadth-first route over the road grid: intersections are the nodes, roads
// the edges. Used by the autopilot (and the taxi GPS) so scripted drives
// follow streets instead of cutting through buildings.
export function findRoute(from, to) {
  const ix = (x) => clamp(Math.round(x / PITCH), 0, COLS);
  const iz = (z) => clamp(Math.round(z / PITCH), 0, ROWS);
  const sx = ix(from[0]); const sz = iz(from[1]);
  const tx = ix(to[0]); const tz = iz(to[1]);
  const key = (x, z) => `${x},${z}`;
  const prev = new Map([[key(sx, sz), null]]);
  const queue = [[sx, sz]];
  while (queue.length) {
    const [cx, cz] = queue.shift();
    if (cx === tx && cz === tz) break;
    for (const [nx, nz] of [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]]) {
      if (nx < 0 || nx > COLS || nz < 0 || nz > ROWS || prev.has(key(nx, nz))) continue;
      prev.set(key(nx, nz), [cx, cz]);
      queue.push([nx, nz]);
    }
  }
  const path = [];
  let cur = [tx, tz];
  while (cur) {
    path.unshift([cur[0] * PITCH, cur[1] * PITCH]);
    cur = prev.get(key(cur[0], cur[1]));
  }
  path.push([to[0], to[1]]);
  return path;
}

// City geometry, derived once from the seed: buildings fill each block's
// interior (never the roads), lamps line the streets, palms dot the sidewalks.
export function buildCity(seed) {
  const rng = createRng(seed);
  const buildings = [];
  for (const d of DISTRICTS) {
    const bx = d.col * PITCH + ROAD / 2;
    const bz = d.row * PITCH + ROAD / 2;
    const count = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i += 1) {
      const w = 14 + rng() * 22;
      const depth = 14 + rng() * 22;
      const x = bx + 8 + rng() * (BLOCK - 16 - w);
      const z = bz + 8 + rng() * (BLOCK - 16 - depth);
      buildings.push({
        x, z, w, d: depth, h: 10 + rng() * 34,
        district: d.name, palette: d.palette, neon: d.neon,
        windows: 0.35 + rng() * 0.6,
      });
    }
  }
  const lamps = [];
  for (let i = 0; i <= COLS; i += 1) {
    for (let j = 0; j <= ROWS; j += 1) {
      lamps.push([i * PITCH - 6, j * PITCH - 6]);
      lamps.push([i * PITCH + 6, j * PITCH + 6]);
    }
  }
  const palms = [];
  for (let i = 0; i < 40; i += 1) {
    palms.push([rng() * CITY_W, rng() * CITY_H]);
  }
  return { buildings, lamps, palms };
}

export function createGame(seed = 20261121) {
  const rng = createRng(seed);
  const city = buildCity(seed);
  // 24 hidden harbor tokens, on the roads and sidewalks (never inside a
  // building) plus a few on the marina dock.
  const collectibles = [];
  for (let i = 0; i < 24; i += 1) {
    if (i >= 20) {
      collectibles.push({
        id: i,
        x: (3.6 + rng() * 1.2) * PITCH,
        z: WATER_Z - 14 - rng() * 10,
        got: false,
      });
    } else if (rng() < 0.5) {
      // On a vertical road: x on a grid line, z anywhere along it.
      collectibles.push({
        id: i,
        x: Math.floor(rng() * (COLS + 1)) * PITCH + (rng() - 0.5) * 10,
        z: 10 + rng() * (CITY_H - 20),
        got: false,
      });
    } else {
      // On a horizontal road: z on a grid line, x anywhere along it.
      collectibles.push({
        id: i,
        x: 10 + rng() * (CITY_W - 20),
        z: Math.floor(rng() * (ROWS + 1)) * PITCH + (rng() - 0.5) * 10,
        got: false,
      });
    }
  }
  const traffic = [];
  const loops = [
    [[0, 0], [5, 0], [5, 2], [0, 2]],
    [[1, 0], [3, 0], [3, 2], [1, 2]],
    [[0, 0], [2, 0], [2, 2], [0, 2]],
  ];
  const carColors = ['#d8d8d8', '#3d6bff', '#ff8a3d', '#59d867', '#e8e03d', '#c9c9c9'];
  for (let i = 0; i < 12; i += 1) {
    const loop = loops[i % loops.length];
    const seg = Math.floor(rng() * loop.length);
    const a = loop[seg]; const b = loop[(seg + 1) % loop.length];
    const t = rng();
    traffic.push({
      id: i, kind: 'traffic', color: carColors[i % carColors.length],
      x: (a[0] + (b[0] - a[0]) * t) * PITCH, z: (a[1] + (b[1] - a[1]) * t) * PITCH,
      heading: Math.atan2(b[0] - a[0], b[1] - a[1]), speed: 9 + rng() * 5,
      loop, seg, t, stolen: false,
    });
  }
  // The Comet GT Sam wants, parked on the Sunset Strip road; the player's
  // starter car is cyan, parked on Neon Row.
  const comet = {
    id: 100, kind: 'parked', name: 'Comet GT', color: '#ff3d6e',
    x: 3 * PITCH + 30, z: 1 * PITCH, heading: Math.PI / 2, speed: 0, stolen: false,
  };
  const starter = {
    id: 101, kind: 'player', name: 'Harbor Runner', color: '#19d3e6',
    x: 1 * PITCH, z: 0, heading: 0, speed: 0, stolen: false,
  };
  const peds = [];
  for (let i = 0; i < 24; i += 1) {
    peds.push({
      id: i, x: rng() * CITY_W, z: rng() * CITY_H,
      heading: rng() * TAU, speed: 1 + rng() * 1.2, panic: 0,
      shirt: ['#ff5e7a', '#59e389', '#7fd4ff', '#ffd94d', '#e04df0'][i % 5],
    });
  }
  const boat = {
    id: 200, kind: 'boat', name: 'Hale\'s Skiff', color: '#e8e8e8',
    x: 4.5 * PITCH, z: WATER_Z + 6, heading: Math.PI, speed: 0,
  };
  const crates = [
    [2.0 * PITCH, WATER_Z + 55], [2.8 * PITCH, WATER_Z + 70], [1.4 * PITCH, WATER_Z + 78],
  ].map(([x, z], i) => ({ id: i, x, z, got: false }));
  return {
    seed, rng, city, time: 17.5, playtime: 0,
    player: {
      x: 1 * PITCH, z: 14, heading: 0, speed: 0,
      onFoot: true, car: null, boat: false, health: 100, cash: 150,
      ammo: 0, hasPistol: false, color: '#19d3e6',
    },
    cars: [starter, comet, ...traffic],
    peds, boat, crates, collectibles,
    wanted: 0, heat: 0, lastCrime: -999, police: [], heli: null, roadblocks: [],
    jobsDone: [], jobIndex: 0, jobStep: 0, jobState: 'idle',
    jobChoice: null, race: null, raceWon: [], taxi: null,
    turf: TURF_ZONES.map((z) => ({ ...z, owned: false, hold: 0 })),
    turfIncome: 0, turfTimer: 0,
    crew: [], respect: 0, respectRank: 0,
    stats: { jobs: 0, races: 0, fares: 0, carsStolen: 0, tokens: 0, shotsFired: 0, policeDown: 0 },
    log: [],
  };
}

export function wantedStars(state) { return Math.min(5, Math.floor(state.heat / 20)); }
export function respectRank(state) { return Math.min(4, Math.floor(state.respect / 400)); }
export function percentComplete(state) {
  const jobs = (state.jobsDone.length / JOBS.length) * 50;
  const tokens = (state.stats.tokens / 24) * 20;
  const races = (state.raceWon.length / RACES.length) * 15;
  const turf = (state.turf.filter((t) => t.owned).length / TURF_ZONES.length) * 15;
  return Math.round(jobs + tokens + races + turf);
}
export function currentJob(state) { return JOBS[state.jobIndex] ?? null; }
export function currentStep(state) {
  const job = currentJob(state);
  return job ? job.steps[state.jobStep] : null;
}
export function saveData(state) {
  return {
    cash: state.player.cash, jobsDone: state.jobsDone, jobIndex: state.jobIndex,
    tokens: state.stats.tokens, raceWon: state.raceWon,
    turf: state.turf.map((t) => t.owned), crew: state.crew.map((c) => c.id),
    respect: state.respect, percent: percentComplete(state),
  };
}
export function loadSave(state, data) {
  if (!data) return false;
  state.player.cash = data.cash ?? 150;
  state.jobsDone = data.jobsDone ?? [];
  state.jobIndex = data.jobIndex ?? 0;
  state.stats.tokens = data.tokens ?? 0;
  state.raceWon = data.raceWon ?? [];
  state.crew = CREW.filter((c) => (data.crew ?? []).includes(c.id));
  state.respect = data.respect ?? 0;
  (data.turf ?? []).forEach((owned, i) => { if (state.turf[i]) state.turf[i].owned = owned; });
  return true;
}

// ---- step logic (appended to sim.js) ----

function buildingAt(state, x, z, pad) {
  for (const b of state.city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && z > b.z - pad && z < b.z + b.d + pad) return b;
  }
  return null;
}

function resolveBuildingCollision(state, e, radius) {
  const b = buildingAt(state, e.x, e.z, radius);
  if (!b) return;
  const left = e.x - (b.x - radius); const right = (b.x + b.w + radius) - e.x;
  const top = e.z - (b.z - radius); const bottom = (b.z + b.d + radius) - e.z;
  const m = Math.min(left, right, top, bottom);
  if (m === left) e.x = b.x - radius;
  else if (m === right) e.x = b.x + b.w + radius;
  else if (m === top) e.z = b.z - radius;
  else e.z = b.z + b.d + radius;
  e.speed *= 0.4;
}

export function commitCrime(state, heat) {
  state.heat = Math.min(100, state.heat + heat);
  state.lastCrime = state.playtime;
  state.wanted = wantedStars(state);
}

export function startJob(state, index) {
  const job = JOBS[index];
  if (!job) return false;
  state.jobIndex = index;
  state.jobStep = 0;
  state.jobState = 'active';
  state.log.push(job.intro);
  return true;
}

export function chooseOption(state, optionIndex) {
  const job = currentJob(state);
  const step = currentStep(state);
  if (!job || !step || step.type !== 'choice') return false;
  state.jobChoice = { job: job.id, option: optionIndex };
  if (job.id === 'job3' && optionIndex === 1) {
    state.player.cash += 150; // stripping pays $150 extra on top of the reward
    commitCrime(state, 20);
    state.log.push('Sam: "Parts it is. Keep your head down — that car was somebody\'s pride."');
  }
  if (job.id === 'job7' && optionIndex === 0) {
    if (state.player.cash < 500) return false; // the bribe needs the cash
    state.player.cash -= 500;
    state.heat = 0; state.wanted = 0;
    state.log.push('Harbor master: "Pleasure doing business. The ferry sails at dawn."');
  }
  completeJob(state);
  return true;
}

function completeJob(state) {
  const job = currentJob(state);
  if (!job) return;
  state.player.cash += job.reward;
  state.respect += 150;
  state.respectRank = respectRank(state);
  state.stats.jobs += 1;
  state.jobsDone.push(job.id);
  state.log.push(job.outro);
  if (job.id === 'job1' && !state.crew.find((c) => c.id === 'marisol')) state.crew.push(CREW[0]);
  if (job.id === 'job2' && !state.crew.find((c) => c.id === 'lena')) state.crew.push(CREW[2]);
  if (job.id === 'job3' && !state.crew.find((c) => c.id === 'sam')) state.crew.push(CREW[1]);
  state.jobIndex += 1;
  state.jobStep = 0;
  state.jobState = state.jobIndex >= JOBS.length ? 'done' : 'idle';
}

function advanceStep(state) {
  const job = currentJob(state);
  if (!job) return;
  state.jobStep += 1;
  if (state.jobStep >= job.steps.length) completeJob(state);
}

function startRace(state, raceId) {
  const race = RACES.find((r) => r.id === raceId);
  if (!race || state.race) return false;
  const rival = RIVALS[race.rival];
  state.race = {
    id: race.id, name: race.name, rival: rival.name, rivalColor: rival.color,
    checkpoints: race.checkpoints, index: 0, rivalIndex: 0,
    rivalPos: [...race.checkpoints[0]], rivalSpeed: 13.5, prize: race.prize,
    finished: false, won: false, time: 0,
  };
  state.log.push(`Race started: ${race.name} vs ${rival.name}.`);
  return true;
}

function stepRace(state, dt) {
  const race = state.race;
  if (!race) return;
  race.time += dt;
  const p = state.player;
  const cp = race.checkpoints[race.index];
  if (cp && dist(p.x, p.z, cp[0], cp[1]) < 14) {
    race.index += 1;
    if (race.index >= race.checkpoints.length) {
      race.finished = true;
      race.won = race.rivalIndex < race.checkpoints.length;
      if (race.won) {
        state.player.cash += race.prize;
        state.respect += 120;
        state.stats.races += 1;
        if (!state.raceWon.includes(race.id)) state.raceWon.push(race.id);
        state.log.push(`You won the ${race.name}! +$${race.prize}.`);
      } else {
        state.log.push(`${race.rival} won the ${race.name}. Run it back.`);
      }
      state.race = null;
      if (currentStep(state)?.type === 'race') advanceStep(state);
      return;
    }
  }
  // The rival follows the checkpoint line at a steady pace, slightly slower
  // than a well-driven player car, so a clean run wins and a sloppy one loses.
  if (race.rivalIndex < race.checkpoints.length) {
    const target = race.checkpoints[race.rivalIndex];
    const d = dist(race.rivalPos[0], race.rivalPos[1], target[0], target[1]);
    const stepLen = race.rivalSpeed * dt;
    if (d <= Math.max(stepLen, 2)) race.rivalIndex += 1;
    else {
      race.rivalPos[0] += ((target[0] - race.rivalPos[0]) / d) * stepLen;
      race.rivalPos[1] += ((target[1] - race.rivalPos[1]) / d) * stepLen;
    }
  }
}

function stepPolice(state, dt) {
  const stars = wantedStars(state);
  state.wanted = stars;
  const want = stars; // one police car per star, capped at 5
  while (state.police.length < want) {
    const a = state.rng() * Math.PI * 2;
    state.police.push({
      id: 300 + state.police.length, kind: 'police', color: '#1c1c22',
      x: state.player.x + Math.cos(a) * 70, z: state.player.z + Math.sin(a) * 70,
      heading: 0, speed: 0, siren: true,
    });
  }
  while (state.police.length > want) state.police.pop();
  for (const cop of state.police) {
    const d = dist(cop.x, cop.z, state.player.x, state.player.z);
    const wantHeading = Math.atan2(state.player.x - cop.x, state.player.z - cop.z);
    cop.heading = angleLerp(cop.heading, wantHeading, clamp(dt * 2.2, 0, 1));
    cop.speed = clamp(d > 8 ? cop.speed + 26 * dt : cop.speed - 20 * dt, 0, 21 + stars);
    cop.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.z += Math.cos(cop.heading) * cop.speed * dt;
    resolveBuildingCollision(state, cop, 2);
    if (d < 3.5) { // police contact: a brush at speed is a scrape, not a bust.
      // Only a cornered player takes damage — on foot, or crawling under 6
      // units/s. A fast getaway can push past a cop car unharmed.
      const cornered = state.player.onFoot || Math.abs(state.player.speed ?? 0) < 6;
      if (!cornered) continue;
      state.player.health -= 20 * dt;
      if (state.player.health <= 0) {
        state.player.health = 100;
        state.heat = 0; state.wanted = 0;
        state.player.cash = Math.max(0, state.player.cash - 100);
        state.player.x = 1 * PITCH; state.player.z = 14;
        if (state.player.car) { state.player.car = null; state.player.onFoot = true; }
        state.log.push('Busted. The cops took $100 and dropped you back at Neon Row.');
      }
    }
  }
  // Helicopter with a searchlight at 4+ stars.
  if (stars >= 4 && !state.heli) {
    state.heli = { x: state.player.x, z: state.player.z - 40, heading: 0, beam: 0.16, opacity: 0.22 };
    state.log.push('Police helicopter overhead — its searchlight is sweeping the streets.');
  }
  if (stars < 4) state.heli = null;
  if (state.heli) {
    state.heli.x = state.player.x + Math.sin(state.playtime * 0.4) * 12;
    state.heli.z = state.player.z - 30 + Math.cos(state.playtime * 0.3) * 8;
  }
  // Roadblocks at 3+ stars: two police cars parked across the road ahead.
  if (stars >= 3) {
    if (!state.roadblocks) state.roadblocks = [];
    if (state.roadblocks.length === 0) {
      const ahead = 46;
      const px = state.player.x + Math.sin(state.player.heading) * ahead;
      const pz = state.player.z + Math.cos(state.player.heading) * ahead;
      const perp = state.player.heading + Math.PI / 2;
      state.roadblocks = [
        { x: px + Math.sin(perp) * 5, z: pz + Math.cos(perp) * 5, heading: state.player.heading },
        { x: px - Math.sin(perp) * 5, z: pz - Math.cos(perp) * 5, heading: state.player.heading },
      ];
      state.log.push('Police roadblock ahead — find another way around.');
    }
  } else {
    state.roadblocks = [];
  }
}

function stepTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    // A stolen car no longer drives its loop: the thief owns it now, and a
    // car the player is driving must answer only to the player's steering —
    // otherwise the loop autopilot fights the driver and drags the car off
    // the road (this wedged the ferry run into a building at 4 stars).
    if (car.stolen || state.player.car === car) continue;
    const a = car.loop[car.seg]; const b = car.loop[(car.seg + 1) % car.loop.length];
    const target = [b[0] * PITCH, b[1] * PITCH];
    const d = dist(car.x, car.z, target[0], target[1]);
    if (d < 3) { car.seg = (car.seg + 1) % car.loop.length; continue; }
    const want = Math.atan2(target[0] - car.x, target[1] - car.z);
    car.heading = angleLerp(car.heading, want, clamp(dt * 3, 0, 1));
    // Slow down for the car ahead — and stop for a pedestrian stepping out:
    // that is how a car gets stolen in this city.
    let blocked = false;
    for (const other of state.cars) {
      if (other === car) continue;
      const od = dist(car.x, car.z, other.x, other.z);
      if (od < 10 && od > 0.1) {
        const ahead = Math.sin(car.heading) * (other.x - car.x) + Math.cos(car.heading) * (other.z - car.z);
        if (ahead > 0) { blocked = true; break; }
      }
    }
    if (state.player.onFoot && dist(car.x, car.z, state.player.x, state.player.z) < 10) blocked = true;
    const targetSpeed = blocked ? 0 : car.speed;
    car.x += Math.sin(car.heading) * targetSpeed * dt;
    car.z += Math.cos(car.heading) * targetSpeed * dt;
  }
}

function stepPeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.x += Math.sin(ped.heading) * 5 * dt;
      ped.z += Math.cos(ped.heading) * 5 * dt;
    } else {
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;
      if (state.rng() < dt * 0.05) ped.heading = state.rng() * Math.PI * 2;
    }
    ped.x = clamp(ped.x, 0, CITY_W);
    ped.z = clamp(ped.z, 0, CITY_H);
    resolveBuildingCollision(state, ped, 1);
    const pd = dist(ped.x, ped.z, state.player.x, state.player.z);
    if (!state.player.onFoot && state.player.car && pd < 6 && state.player.car.speed > 8) {
      ped.panic = 3;
      ped.heading = Math.atan2(ped.x - state.player.x, ped.z - state.player.z);
    }
  }
}

function stepJob(state, dt) {
  const job = currentJob(state);
  if (!job || state.jobState !== 'active') return;
  const step = job.steps[state.jobStep];
  if (!step) return;
  const p = state.player;
  if (step.type === 'goto' || step.type === 'pickup' || step.type === 'deliver') {
    if (dist(p.x, p.z, step.at[0], step.at[1]) < 12) {
      if (step.type === 'pickup') state.log.push('Package secured.');
      advanceStep(state);
    }
  } else if (step.type === 'steal') {
    if (p.car && p.car.name === step.car) advanceStep(state);
  } else if (step.type === 'boat') {
    let done = true;
    for (const crate of state.crates) {
      if (!crate.got && dist(p.x, p.z, crate.x, crate.z) < 10) {
        crate.got = true;
        state.log.push(`Crate ${state.crates.filter((c) => c.got).length}/3 recovered.`);
      }
      if (!crate.got) done = false;
    }
    if (done) advanceStep(state);
  } else if (step.type === 'race') {
    if (!state.race) startRace(state, step.race);
  } else if (step.type === 'turf') {
    const zone = state.turf.find((t) => dist(t.at[0], t.at[1], step.at[0], step.at[1]) < 1);
    if (zone && zone.owned) advanceStep(state);
  } else if (step.type === 'escape') {
    if (state.wanted >= 4 && dist(p.x, p.z, step.at[0], step.at[1]) < 14) advanceStep(state);
    else if (state.wanted < 4 && dist(p.x, p.z, step.at[0], step.at[1]) < 14) {
      const msg = 'The ferry will not take you while the heat is low — make some noise first.';
      if (state.log[state.log.length - 1] !== msg) state.log.push(msg);
    }
  }
}

function stepTurf(state, dt) {
  for (const zone of state.turf) {
    const p = state.player;
    if (dist(p.x, p.z, zone.at[0], zone.at[1]) < 12 && state.wanted === 0) {
      zone.hold += dt;
      if (zone.hold >= 5 && !zone.owned) {
        zone.owned = true;
        state.respect += 80;
        state.log.push(`${zone.name} is yours now. Turf pays $50 a minute.`);
      }
    } else {
      zone.hold = Math.max(0, zone.hold - dt);
    }
  }
  state.turfTimer += dt;
  const owned = state.turf.filter((t) => t.owned).length;
  if (state.turfTimer >= 60 && owned > 0) {
    state.turfTimer = 0;
    const pay = owned * 50;
    state.player.cash += pay;
    state.turfIncome += pay;
    state.log.push(`Turf income: +$${pay}.`);
  }
}

function stepEconomy(state, dt) {
  // Collectibles: walk or drive over a token to pocket it.
  for (const c of state.collectibles) {
    if (!c.got && dist(state.player.x, state.player.z, c.x, c.z) < 5) {
      c.got = true;
      state.stats.tokens += 1;
      state.player.cash += 25;
      state.respect += 10;
      state.log.push(`Harbor token ${state.stats.tokens}/24 found. +$25.`);
    }
  }
  // Taxi fares: a waiting fare appears at a nearby intersection, with a
  // destination at another intersection, so the drive is always on roads.
  if (!state.taxi && state.rng() < dt * 0.02) {
    const fx = Math.floor(clamp(state.player.x / PITCH, 0, COLS) + (state.rng() < 0.5 ? -1 : 1)) * PITCH;
    const fz = Math.floor(clamp(state.player.z / PITCH, 0, ROWS) + (state.rng() < 0.5 ? -1 : 1)) * PITCH;
    const dx = clamp(Math.round((fx + 120) / PITCH), 0, COLS) * PITCH;
    const dz = clamp(Math.round((fz - 60) / PITCH), 0, ROWS) * PITCH;
    state.taxi = { x: clamp(fx, 0, CITY_W), z: clamp(fz, 0, CITY_H), dest: [dx, dz], fare: 40 + Math.floor(state.rng() * 40) };
  }
  if (state.taxi) {
    const t = state.taxi;
    if (!t.picked && dist(state.player.x, state.player.z, t.x, t.z) < 8 && state.player.car) {
      t.picked = true;
      state.log.push(`Fare aboard — take them to the marker. $${t.fare} on delivery.`);
    } else if (t.picked && dist(state.player.x, state.player.z, t.dest[0], t.dest[1]) < 12) {
      state.player.cash += t.fare;
      state.stats.fares += 1;
      state.log.push(`Fare delivered. +$${t.fare}.`);
      state.taxi = null;
    }
  }
  // Wanted heat fades when the player keeps clean (Lena doubles the fade) —
  // except during an escape step, where the heat is locked in: the cops are
  // already on you, and the job is to outrun them, not to wait them out.
  const hasLena = state.crew.some((c) => c.id === 'lena');
  const escaping = currentStep(state)?.type === 'escape' && state.jobState === 'active';
  if (!escaping && state.playtime - state.lastCrime > 10 && state.heat > 0) {
    state.heat = Math.max(0, state.heat - dt * (hasLena ? 4 : 2));
    state.wanted = wantedStars(state);
  }
}

// input: { forward, back, left, right, enter, shoot, interact, choice }
// enter: pressed this frame to enter/exit a car or boat. shoot: firing.
// choice: 0/1 to resolve a choice step. interact: buy at a shop / start a job.
export function stepGame(state, input, dt = STEP) {
  state.playtime += dt;
  state.time += dt / 240; // a full day takes 4 minutes of play
  if (state.time >= 24) state.time -= 24;
  const p = state.player;

  if (input.enter) {
    if (p.boat) {
      // Getting out in open water strands the player: only the dock shallows
      // (within 10 units past the waterline) are safe to step off at.
      const tooDeep = state.boat.z > WATER_Z + 10;
      if (tooDeep) {
        const msg = 'Too deep to get out here — sail back to the dock.';
        if (state.log[state.log.length - 1] !== msg) state.log.push(msg);
      } else {
        p.boat = false; p.onFoot = true;
        p.x = state.boat.x; p.z = state.boat.z - 6;
      }
    } else if (p.car) {
      const car = p.car;
      p.car = null; p.onFoot = true;
      p.x = car.x + Math.cos(car.heading) * 3; p.z = car.z - Math.sin(car.heading) * 3;
    } else if (dist(p.x, p.z, state.boat.x, state.boat.z) < 12) {
      p.boat = true; p.onFoot = false;
      p.x = state.boat.x; p.z = state.boat.z;
    } else {
      let best = null; let bestD = 5;
      for (const car of state.cars) {
        const d = dist(p.x, p.z, car.x, car.z);
        if (d < bestD) { best = car; bestD = d; }
      }
      if (best) {
        p.car = best; p.onFoot = false;
        if ((best.kind === 'traffic' || best.kind === 'parked') && !best.stolen) {
          best.stolen = true;
          state.stats.carsStolen += 1;
          commitCrime(state, 20);
          state.log.push('Car stolen — the owner called it in. +1 wanted star.');
        }
      }
    }
  }

  if (input.interact) {
    const job = currentJob(state);
    if (job && state.jobState === 'idle') {
      startJob(state, state.jobIndex);
    }
    if (dist(p.x, p.z, GUN_SHOP.at[0], GUN_SHOP.at[1]) < 12 && !p.hasPistol && p.cash >= GUN_SHOP.pistol) {
      p.cash -= GUN_SHOP.pistol; p.hasPistol = true; p.ammo = 24;
      state.log.push('Pistol bought at Lou\'s Guns. $200.');
    } else if (dist(p.x, p.z, GUN_SHOP.at[0], GUN_SHOP.at[1]) < 12 && p.hasPistol && p.cash >= GUN_SHOP.ammo) {
      p.cash -= GUN_SHOP.ammo; p.ammo += 24;
      state.log.push('Ammo restocked. $40.');
    }
    if (p.car && dist(p.x, p.z, RESPRAY_SHOP.at[0], RESPRAY_SHOP.at[1]) < 12) {
      const price = state.crew.some((c) => c.id === 'sam') ? 50 : RESPRAY_SHOP.price;
      if (p.cash >= price) {
        p.cash -= price;
        const colors = ['#19d3e6', '#ff3d6e', '#ffd94d', '#59e389', '#b04dff'];
        const next = colors[(colors.indexOf(p.car.color) + 1) % colors.length];
        p.car.color = next; p.color = next;
        state.log.push(`Resprayed the ${p.car.name} — now ${next}.`);
      }
    }
  }

  if (typeof input.choice === 'number') chooseOption(state, input.choice);

  // Movement: on foot, in a car, or in the boat.
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const throttle = (input.forward ? 1 : 0) - (input.back ? 0.6 : 0);
  if (p.boat) {
    const b = state.boat;
    b.heading += steer * 1.6 * dt;
    b.speed = clamp(b.speed + throttle * 14 * dt, -6, 16);
    b.speed *= (1 - 0.4 * dt);
    b.x += Math.sin(b.heading) * b.speed * dt;
    b.z += Math.cos(b.heading) * b.speed * dt;
    b.x = clamp(b.x, 20, CITY_W - 20);
    b.z = clamp(b.z, WATER_Z + 4, WATER_Z + 110);
    p.x = b.x; p.z = b.z; p.heading = b.heading;
  } else if (p.car) {
    const car = p.car;
    const grip = state.crew.some((c) => c.id === 'marisol') ? 1.15 : 1;
    car.heading += steer * 1.9 * dt * clamp(Math.abs(car.speed) / 8, 0.3, 1) * (car.speed >= 0 ? 1 : -1);
    car.speed = clamp(car.speed + throttle * 22 * dt, -10, 30 * grip);
    car.speed *= (1 - 0.5 * dt);
    if (!input.forward && !input.back) car.speed *= (1 - 1.2 * dt);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.x = clamp(car.x, 0, CITY_W);
    car.z = clamp(car.z, 0, WATER_Z - 6);
    resolveBuildingCollision(state, car, 2.2);
    // A roadblock slows the car down hard but never traps it: the driver can
    // push through the gap between the two parked police cars.
    for (const rb of state.roadblocks ?? []) {
      if (dist(car.x, car.z, rb.x, rb.z) < 4) car.speed *= (1 - 2.4 * dt);
    }
    p.x = car.x; p.z = car.z; p.heading = car.heading; p.speed = car.speed;
    if (Math.abs(car.speed) > 24) commitCrime(state, 0.2 * dt); // speeding past a cop's patience
    for (const ped of state.peds) {
      if (dist(ped.x, ped.z, p.x, p.z) < 2.5 && Math.abs(car.speed) > 4) {
        commitCrime(state, 20);
        ped.panic = 4;
        ped.heading = Math.atan2(ped.x - p.x, ped.z - p.z);
        ped.x += Math.sin(ped.heading) * 6;
        ped.z += Math.cos(ped.heading) * 6;
      }
    }
  } else {
    p.heading += steer * 2.4 * dt;
    const sp = throttle > 0 ? 6 : throttle < 0 ? 3 : 0;
    p.speed = sp;
    p.x += Math.sin(p.heading) * sp * dt;
    p.z += Math.cos(p.heading) * sp * dt;
    p.x = clamp(p.x, 0, CITY_W);
    p.z = clamp(p.z, 0, WATER_Z + 8); // the player can wade to the dock edge
    resolveBuildingCollision(state, p, 1);
  }

  if (input.shoot && p.hasPistol && p.ammo > 0) {
    p.ammo -= 1;
    state.stats.shotsFired += 1;
    let best = null; let bestD = 32;
    for (const cop of state.police) {
      const d = dist(p.x, p.z, cop.x, cop.z);
      if (d < bestD) { best = cop; bestD = d; }
    }
    if (best) {
      state.police = state.police.filter((c) => c !== best);
      state.stats.policeDown += 1;
      commitCrime(state, 20);
      state.log.push('Police car disabled.');
    }
  }

  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepPolice(state, dt);
  stepRace(state, dt);
  stepJob(state, dt);
  stepTurf(state, dt);
  stepEconomy(state, dt);
  state.respectRank = respectRank(state);
  return state;
}

// Deterministic fingerprint of the world (for the double-run check).
export function worldHash(state) {
  const parts = [
    Math.round(state.player.x * 100), Math.round(state.player.z * 100),
    state.player.cash, state.jobsDone.length, state.stats.tokens,
    state.raceWon.length, state.turf.filter((t) => t.owned).length,
    state.crew.length, state.respect, state.stats.shotsFired,
  ];
  return parts.join(':');
}
