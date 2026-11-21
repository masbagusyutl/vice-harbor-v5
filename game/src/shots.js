// Vice Harbor — staged screenshot scenes.
// Each shot plays the real sim forward from a fresh world for a few seconds
// (traffic moving, pedestrians walking, police chasing) and then freezes it
// with a composed camera, so the frame is what the game really looks like
// and the same seed always gives the same frame.
//
// v5 composition fixes (from the v4 screenshot review):
// - Shot 2 (sunset chase): the player car is the clear subject — pulled the
//   camera in close and low, centred the car, and kept the cyan paint
//   against the orange sunset street so it reads at thumbnail size.
// - Shot 3 (night race): the helicopter searchlight is a narrow, dim beam
//   (0.16 rad, 0.22 opacity) aimed at the road ahead, so the car and the
//   road stay readable instead of the cone owning the frame; staged on the
//   z=114 avenue after a palm crown blocked the z=0 sightline.
// - Shot 4 was re-framed after review: the pause panel hid the parked car,
//   so the camera now sits close and low with the car in the lower third.
// - Car paint got a faint emissive so the cyan starter reads cyan in shadow
//   and at night (bare metal went near-black with no env map).
// - Shot 1 was re-checked at thumbnail size; its subject (the title over
//   the golden-hour avenue) already reads clearly, so its framing is
//   unchanged.
import {
  createGame, stepGame, PITCH, WATER_Z, STEP,
} from './sim.js';
import { chaseCamera } from './render.js';

const MARISOL_CHASE_LINE = 'Marisol: "Keep it tight through the Strip, Marco — two stars and counting. Do not let them box you in."';

function stepWorld(state, seconds, input = {}) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepGame(state, input);
}

function parkPoliceBehind(state, count) {
  const p = state.player;
  state.police = [];
  for (let i = 0; i < count; i += 1) {
    const behind = 22 + i * 16;
    state.police.push({
      id: 300 + i, kind: 'police', color: '#1c1c22',
      x: p.x - Math.sin(p.heading) * behind + (i % 2 ? 4 : -4),
      z: p.z - Math.cos(p.heading) * behind,
      heading: p.heading, speed: 18, siren: true,
    });
  }
}

// Shot 1 — golden-hour title: the avenue runs away into the low sun, the
// cyan Harbor Runner parked on Neon Row, Marco on foot beside it.
function stageTitle() {
  const state = createGame(20261121);
  state.time = 17.6;
  state.player.x = 1 * PITCH;
  state.player.z = 14;
  state.player.heading = 0.4;
  stepWorld(state, 2);
  return {
    state,
    screen: 'title',
    camera: {
      x: 285, y: 34, z: -95,
      lookX: 285, lookY: 6, lookZ: 130, fov: 55,
    },
  };
}

// Shot 2 — sunset chase: cyan car large and centred, low chase camera,
// Marisol on the radio, two stars, traffic and police in frame.
function stageChase() {
  const state = createGame(20261121);
  state.time = 18.3;
  const car = state.cars[0];
  state.player.car = car;
  state.player.onFoot = false;
  state.player.x = 3 * PITCH;
  state.player.z = 1 * PITCH;
  state.player.heading = Math.PI / 2; // driving east down the Strip road
  car.x = state.player.x;
  car.z = state.player.z;
  car.heading = state.player.heading;
  car.speed = 18;
  state.heat = 40; // two wanted stars
  state.wanted = 2;
  state.lastCrime = state.playtime;
  parkPoliceBehind(state, 2);
  // One pursuit car in the oncoming lane ahead, so the chase reads in frame
  // (the two behind sit past the chase camera and never show).
  state.police.push({
    id: 302, kind: 'police', color: '#1c1c22',
    x: state.player.x + 34, z: state.player.z - 9,
    heading: -Math.PI / 2, speed: 16, siren: true,
  });
  state.log.push(MARISOL_CHASE_LINE);
  stepWorld(state, 1.2, { forward: true });
  // The v5 fix: a close, low three-quarter chase camera that keeps the cyan
  // car big and centred against the orange street (was: far, small,
  // pink-on-pink) and shows its sunlit north flank, not just the rear.
  const camera = chaseCamera(state, 11, 4.5, 55, 4);
  return { state, screen: 'play', camera, dialogue: MARISOL_CHASE_LINE };
}

// Shot 3 — night race: leading the Neon Loop at 21:00, four stars, the
// helicopter overhead with its beam tamed to a narrow dim cone.
function stageNight() {
  const state = createGame(20261121);
  state.time = 21.2;
  const car = state.cars[0];
  state.player.car = car;
  state.player.onFoot = false;
  // Mid-Neon-Loop on the z=114 avenue (the z=0 staging put a palm crown
  // dead-centre in the sightline); car and road stay readable under the
  // narrow dim beam, with the race panel's "1. YOU" moment kept.
  state.player.x = 2 * PITCH;
  state.player.z = 1 * PITCH;
  state.player.heading = Math.PI / 2;
  car.x = state.player.x;
  car.z = state.player.z;
  car.heading = state.player.heading;
  car.speed = 22;
  state.heat = 85; // four wanted stars
  state.wanted = 4;
  state.lastCrime = state.playtime;
  state.heli = { x: state.player.x, z: state.player.z - 30, heading: 0, beam: 0.16, opacity: 0.22 };
  parkPoliceBehind(state, 2);
  state.race = {
    id: 'neon', name: 'Neon Loop', rival: 'Diego Flint', rivalColor: '#ffb03d',
    checkpoints: [[1 * PITCH, 1 * PITCH], [3 * PITCH, 1 * PITCH], [3 * PITCH, 2 * PITCH], [1 * PITCH, 2 * PITCH]],
    index: 2, rivalIndex: 1,
    rivalPos: [2.4 * PITCH, 1 * PITCH], rivalSpeed: 13.5, prize: 650,
    finished: false, won: false, time: 41,
  };
  state.log.push('Diego Flint: "You got lucky at the lights, Marco. It will not last."');
  stepWorld(state, 1.0, { forward: true });
  const camera = chaseCamera(state, 10, 5, 58, -3);
  return { state, screen: 'play', camera, dialogue: 'Diego Flint: "You got lucky at the lights, Marco. It will not last."' };
}

// Shot 4 — pause screen at 27% COMPLETE: the car parked on the marina
// dock at golden hour, the city behind it, stats on the pause overlay.
function stagePause() {
  const state = createGame(20261121);
  state.time = 17.8;
  state.jobsDone = ['job1', 'job2'];
  state.jobIndex = 2;
  for (let i = 0; i < 5; i += 1) {
    state.collectibles[i].got = true;
    state.stats.tokens += 1;
  }
  state.raceWon = ['sunset'];
  state.stats.races = 1;
  state.turf[0].owned = true;
  state.player.cash = 1240;
  state.respect = 480;
  const car = state.cars[0];
  state.player.car = car;
  state.player.onFoot = false;
  state.player.x = 5 * PITCH - 20;
  state.player.z = WATER_Z - 8;
  state.player.heading = -Math.PI / 2;
  car.x = state.player.x;
  car.z = state.player.z;
  car.heading = state.player.heading;
  car.speed = 0;
  stepWorld(state, 1.5);
  // Frame the parked car low in the shot, clear of the centred pause panel:
  // close camera from the north-west, looking past and above the car toward
  // the water so it sits in the lower third instead of behind the overlay.
  const camera = {
    x: state.player.x - 12, y: 6.5, z: state.player.z - 13,
    lookX: state.player.x + 10, lookY: 4, lookZ: state.player.z + 20, fov: 55,
  };
  return { state, screen: 'paused', camera };
}

export function stageShot(name) {
  if (name === 'chase') return stageChase();
  if (name === 'night') return stageNight();
  if (name === 'pause') return stagePause();
  return stageTitle();
}

export const SHOT_NAMES = ['title', 'chase', 'night', 'pause'];
