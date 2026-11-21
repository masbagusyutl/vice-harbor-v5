// Vice Harbor — three.js renderer.
// Builds the city once from the sim's data (districts, buildings, roads,
// lamps, palms, water) and, every frame, moves the cars, pedestrians, boat
// and helicopter to match the sim state and lights the scene for the time
// of day: low warm sun at golden hour, lit windows and neon after dark.
import * as THREE from '../vendor/three.module.min.js';
import {
  DISTRICTS, PITCH, COLS, ROWS, CITY_W, CITY_H, WATER_Z, clamp,
} from './sim.js';

function makeFacadeTexture(base, litRatio, seed) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, 128, 10);
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let y = 18; y < 248; y += 22) {
    for (let x = 10; x < 118; x += 18) {
      const lit = rnd() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : 'rgba(10,14,22,0.85)';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSignTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 96);
  g.font = 'bold 58px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(text, 256, 50);
  g.shadowBlur = 6;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture() {
  // One big canvas for the whole city floor: sidewalks, roads with lane
  // dashes and crosswalks, the marina strip and the dock edge.
  const W = 1024; const H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const sx = W / CITY_W;
  const sz = H / (WATER_Z + 110);
  const X = (x) => x * sx;
  const Z = (z) => z * sz;
  g.fillStyle = '#43484f'; // sidewalks
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1b1d24'; // asphalt roads
  for (let i = 0; i <= COLS; i += 1) g.fillRect(X(i * PITCH - 9), 0, 18 * sx, Z(CITY_H));
  for (let j = 0; j <= ROWS; j += 1) g.fillRect(0, Z(j * PITCH - 9), X(CITY_W), 18 * sz);
  // Marina strip: pale concrete with dock lines.
  g.fillStyle = '#57534a';
  g.fillRect(0, Z(CITY_H), W, Z(WATER_Z) - Z(CITY_H));
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 2;
  for (let x = 0; x < CITY_W; x += 40) {
    g.beginPath(); g.moveTo(X(x), Z(CITY_H + 8)); g.lineTo(X(x), Z(WATER_Z - 4)); g.stroke();
  }
  // Lane dashes.
  g.fillStyle = '#d8b93d';
  for (let i = 0; i <= COLS; i += 1) {
    for (let z = 0; z < CITY_H; z += 16) g.fillRect(X(i * PITCH) - 1, Z(z), 2, 8 * sz);
  }
  for (let j = 0; j <= ROWS; j += 1) {
    for (let x = 0; x < CITY_W; x += 16) g.fillRect(X(x), Z(j * PITCH) - 1, 8 * sx, 2);
  }
  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(230,230,230,0.75)';
  for (let i = 0; i <= COLS; i += 1) {
    for (let j = 0; j <= ROWS; j += 1) {
      for (let k = -3; k <= 3; k += 1) {
        g.fillRect(X(i * PITCH - 8 + k * 4), Z(j * PITCH - 12), 2.5, 5 * sz);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  // Paint that reads in shadow as well as in sun: low metalness (a bare
  // metal body went nearly black on its shaded side with no env map) plus a
  // faint emissive of the paint colour, so the cyan starter stays cyan at
  // golden hour and at night instead of reading as a black silhouette.
  const bodyMat = new THREE.MeshStandardMaterial({
    color, metalness: 0.3, roughness: 0.35,
    emissive: new THREE.Color(color), emissiveIntensity: 0.28,
  });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101418, metalness: 0.9, roughness: 0.15 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.08, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 });
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 0.9 });
  for (const x of [-0.7, 0.7]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), tailMat);
    tail.position.set(x, 0.62, -2.22);
    group.add(tail);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.4 });
  for (const x of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), headMat);
    head.position.set(x, 0.62, 2.22);
    group.add(head);
  }
  if (isPolice) {
    const barMat = new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 1.6 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.3), barMat);
    bar.position.set(0, 1.42, -0.2);
    group.add(bar);
  }
  group.userData.bodyMat = bodyMat;
  return group;
}

function buildPedMesh(shirt) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 4, 8), mat);
  body.position.y = 0.95;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.7 }),
  );
  head.position.y = 1.72;
  group.add(head);
  return group;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1a2e);
  scene.fog = new THREE.FogExp2(0x2a1a2e, 0.0016);

  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 1200);

  const sun = new THREE.DirectionalLight(0xffb36b, 2.4);
  sun.position.set(-120, 60, 80);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x2a2030, 0.85);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0x403050, 0.5);
  scene.add(amb);

  // Ground: one textured plane for the whole city floor.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_W, WATER_Z + 110),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.55, metalness: 0.25 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(CITY_W / 2, 0, (WATER_Z + 110) / 2);
  scene.add(ground);

  // Harbor water: a glossy plane south of the marina.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_W + 400, 160),
    new THREE.MeshStandardMaterial({ color: 0x0e3d4e, roughness: 0.12, metalness: 0.85, transparent: true, opacity: 0.94 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(CITY_W / 2, 0.15, WATER_Z + 80);
  scene.add(water);

  // Buildings, one per seeded entry, with lit-window facades and a neon
  // sign on one face of each district's tallest block.
  const facades = [
    makeFacadeTexture('#6b5a48', 0.5, 11),
    makeFacadeTexture('#4a5568', 0.65, 23),
    makeFacadeTexture('#5e4632', 0.45, 37),
  ];
  const buildingMats = [];
  const signMeshes = [];
  let signCount = 0;
  return { scene, camera, renderer, sun, hemi, amb, water, facades, buildingMats, signMeshes, signCount };
}

export function buildCityMeshes(r, state) {
  const { scene } = r;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const b of state.city.buildings) {
    const facade = r.facades[Math.abs(Math.floor(b.x + b.z)) % r.facades.length];
    const mat = new THREE.MeshStandardMaterial({
      map: facade, emissiveMap: facade, emissive: 0xffffff, emissiveIntensity: 0.12,
      color: new THREE.Color(b.palette), roughness: 0.85, metalness: 0.05,
    });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x + b.w / 2, b.h / 2, b.z + b.d / 2);
    mesh.userData.baseEmissive = 0.12;
    scene.add(mesh);
    r.buildingMats.push(mat);
  }
  // One neon sign per district, on the tallest building facing the street.
  for (const d of DISTRICTS) {
    const inDistrict = state.city.buildings.filter((b) => b.district === d.name);
    if (!inDistrict.length) continue;
    const tallest = inDistrict.reduce((a, b) => (b.h > a.h ? b : a), inDistrict[0]);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 5),
      new THREE.MeshBasicMaterial({
        map: makeSignTexture(d.sign, d.neon), transparent: true, side: THREE.DoubleSide,
      }),
    );
    sign.position.set(tallest.x + tallest.w / 2, Math.min(tallest.h - 3, 26), tallest.z - 0.4);
    scene.add(sign);
    r.signCount = (r.signCount ?? 0) + 1;
    r.signMeshes.push(sign);
  }
  // Street lamps: pole + glowing head (emissive only, no extra lights).
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.7, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc860, emissiveIntensity: 1.8 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
  for (const [x, z] of state.city.lamps) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 3, z);
    scene.add(pole);
    const head = new THREE.Mesh(headGeo, lampMat);
    head.position.set(x, 6.1, z);
    scene.add(head);
  }
  // Palms along the sidewalks.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2e7d46, roughness: 0.8 });
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 7, 6);
  const crownGeo = new THREE.IcosahedronGeometry(2.2, 0);
  for (const [x, z] of state.city.palms) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    scene.add(trunk);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.scale.y = 0.55;
    crown.position.set(x, 7.4, z);
    scene.add(crown);
  }
}

// The dynamic actors, created once and repositioned every frame.
export function buildActors(r, state) {
  const { scene } = r;
  const actors = { cars: new Map(), peds: new Map(), boat: null, heli: null, crates: [], tokens: [] };
  for (const car of state.cars) {
    const mesh = buildCarMesh(car.color, car.kind === 'police');
    scene.add(mesh);
    actors.cars.set(car.id, mesh);
  }
  for (const ped of state.peds) {
    const mesh = buildPedMesh(ped.shirt);
    scene.add(mesh);
    actors.peds.set(ped.id, mesh);
  }
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.3 }),
  );
  hull.position.y = 0.6;
  boat.add(hull);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.2, 3),
    new THREE.MeshStandardMaterial({ color: 0x2e6f8f, roughness: 0.4, metalness: 0.3 }),
  );
  cabin.position.set(0, 1.6, -0.5);
  boat.add(cabin);
  scene.add(boat);
  actors.boat = boat;
  for (const crate of state.crates) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xc98a2e, roughness: 0.7 }),
    );
    scene.add(mesh);
    actors.crates.push(mesh);
  }
  const tokenGeo = new THREE.OctahedronGeometry(0.9, 0);
  const tokenMat = new THREE.MeshStandardMaterial({ color: 0xffd94d, emissive: 0xffb300, emissiveIntensity: 1.6 });
  for (const c of state.collectibles) {
    const mesh = new THREE.Mesh(tokenGeo, tokenMat);
    mesh.position.set(c.x, 1.4, c.z);
    scene.add(mesh);
    actors.tokens.push(mesh);
  }
  // Police helicopter, with a searchlight cone whose beam is deliberately
  // narrow and dim (the v5 composition fix): the car and road stay readable.
  const heli = new THREE.Group();
  const heliBody = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.5, metalness: 0.6 }),
  );
  heli.add(heliBody);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.08, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.6, metalness: 0.5 }),
  );
  rotor.position.y = 1.0;
  heli.add(rotor);
  heli.userData.rotor = rotor;
  const spot = new THREE.SpotLight(0xfff2c0, 60, 120, 0.16, 0.55, 1.2);
  spot.position.set(0, -0.6, 0);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -30, 6);
  heli.add(spotTarget);
  spot.target = spotTarget;
  heli.add(spot);
  const coneGeo = new THREE.ConeGeometry(7, 34, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2c0, transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(0, -17.6, 3);
  cone.rotation.x = Math.PI;
  heli.add(cone);
  heli.userData.coneMat = coneMat;
  heli.userData.spot = spot;
  heli.visible = false;
  scene.add(heli);
  actors.heli = heli;
  // Roadblock police cars (spawned by the sim at 3+ stars).
  actors.roadblocks = [];
  for (let i = 0; i < 2; i += 1) {
    const mesh = buildCarMesh('#1c1c22', true);
    mesh.visible = false;
    scene.add(mesh);
    actors.roadblocks.push(mesh);
  }
  // The player on foot.
  const player = buildPedMesh('#19d3e6');
  player.scale.set(1.15, 1.15, 1.15);
  scene.add(player);
  actors.player = player;
  return actors;
}

// ---- per-frame sync and time of day (appended to render.js) ----

// Sun position and sky colour for a time of day (hours). Golden hour is the
// default look: low warm sun, amber haze. Night is dark blue with lit
// windows and neon doing the work.
export function applyTimeOfDay(r, hours) {
  const t = hours;
  const day = t >= 6 && t < 18.5;
  const golden = t >= 16.5 && t < 19;
  const night = !day;
  const sunAngle = ((t - 6) / 12) * Math.PI; // 6h sunrise, 18h sunset
  const elev = Math.sin(sunAngle);
  const sunH = clamp(elev, 0.02, 1);
  r.sun.position.set(-Math.cos(sunAngle) * 160, sunH * 130 + 8, 90);
  if (golden) {
    r.sun.color.setHex(0xff9a3d);
    r.sun.intensity = 2.6;
    r.hemi.color.setHex(0xffc890);
    r.hemi.groundColor.setHex(0x3a2a30);
    r.hemi.intensity = 0.75;
    r.amb.intensity = 0.35;
    r.scene.background.setHex(0xef8a3c);
    r.scene.fog.color.setHex(0xd97a44);
    r.scene.fog.density = 0.0016;
    r.renderer.toneMappingExposure = 1.15;
  } else if (night) {
    r.sun.color.setHex(0x8fa8ff);
    r.sun.intensity = 0.35;
    r.hemi.color.setHex(0x2a3a66);
    r.hemi.groundColor.setHex(0x0c0e18);
    r.hemi.intensity = 0.65;
    r.amb.intensity = 0.65;
    r.scene.background.setHex(0x0a0e22);
    r.scene.fog.color.setHex(0x0a0e22);
    r.scene.fog.density = 0.0022;
    r.renderer.toneMappingExposure = 1.05;
  } else {
    r.sun.color.setHex(0xffe0b0);
    r.sun.intensity = 2.0;
    r.hemi.color.setHex(0xbfd4ff);
    r.hemi.groundColor.setHex(0x4a4038);
    r.hemi.intensity = 0.8;
    r.amb.intensity = 0.4;
    r.scene.background.setHex(0x87a8c8);
    r.scene.fog.color.setHex(0x87a8c8);
    r.scene.fog.density = 0.0012;
    r.renderer.toneMappingExposure = 1.1;
  }
  // Windows glow after dark, stay dim in daylight.
  const windowGlow = night ? 0.85 : golden ? 0.3 : 0.12;
  for (const mat of r.buildingMats) mat.emissiveIntensity = windowGlow;
  return { night, golden };
}

// Move every dynamic mesh to the sim's state and render one frame.
// cameraPose: { x, y, z, lookX, lookY, lookZ, fov } — main.js owns the
// chase camera; shots.js owns the staged cameras.
export function drawFrame(r, actors, state, cameraPose, timeOverride) {
  const { night } = applyTimeOfDay(r, timeOverride ?? state.time);
  // Cars: the player's car, traffic, the parked Comet, police.
  for (const car of state.cars) {
    const mesh = actors.cars.get(car.id);
    if (!mesh) continue;
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.heading;
    mesh.userData.bodyMat.color.set(car.color);
  }
  for (const cop of state.police) {
    let mesh = actors.cars.get(cop.id);
    if (!mesh) {
      mesh = buildCarMesh('#1c1c22', true);
      r.scene.add(mesh);
      actors.cars.set(cop.id, mesh);
    }
    mesh.position.set(cop.x, 0, cop.z);
    mesh.rotation.y = cop.heading;
  }
  // Rival race car.
  if (state.race) {
    let mesh = actors.cars.get(900);
    if (!mesh) {
      mesh = buildCarMesh(state.race.rivalColor ?? '#ff3d6e', false);
      r.scene.add(mesh);
      actors.cars.set(900, mesh);
    }
    mesh.visible = true;
    mesh.position.set(state.race.rivalPos[0], 0, state.race.rivalPos[1]);
    const next = state.race.checkpoints[state.race.rivalIndex] ?? state.race.checkpoints[0];
    mesh.rotation.y = Math.atan2(next[0] - state.race.rivalPos[0], next[1] - state.race.rivalPos[1]);
  } else {
    const mesh = actors.cars.get(900);
    if (mesh) mesh.visible = false;
  }
  // Pedestrians.
  for (const ped of state.peds) {
    const mesh = actors.peds.get(ped.id);
    if (!mesh) continue;
    mesh.position.set(ped.x, 0, ped.z);
    mesh.rotation.y = ped.heading;
    mesh.visible = true;
  }
  // Player on foot (hidden while driving or boating).
  actors.player.visible = state.player.onFoot;
  actors.player.position.set(state.player.x, 0, state.player.z);
  actors.player.rotation.y = state.player.heading;
  // Boat + crates bob on the harbor.
  actors.boat.position.set(state.boat.x, 0.2 + Math.sin(state.playtime * 1.4) * 0.12, state.boat.z);
  actors.boat.rotation.y = state.boat.heading;
  state.crates.forEach((crate, i) => {
    const mesh = actors.crates[i];
    mesh.visible = !crate.got;
    mesh.position.set(crate.x, 0.8 + Math.sin(state.playtime * 1.8 + i) * 0.25, crate.z);
    mesh.rotation.y = state.playtime * 0.3 + i;
  });
  // Collectible tokens spin and glow.
  state.collectibles.forEach((c, i) => {
    const mesh = actors.tokens[i];
    mesh.visible = !c.got;
    mesh.position.y = 1.4 + Math.sin(state.playtime * 2 + i) * 0.3;
    mesh.rotation.y = state.playtime * 1.5 + i;
  });
  // Helicopter: narrow dim searchlight (the v5 fix), rotor spinning.
  if (state.heli && actors.heli) {
    actors.heli.visible = true;
    actors.heli.position.set(state.heli.x, 42, state.heli.z);
    actors.heli.userData.rotor.rotation.y = state.playtime * 22;
    const beam = state.heli.beam ?? 0.16;
    const opacity = state.heli.opacity ?? 0.22;
    actors.heli.userData.spot.angle = beam;
    actors.heli.userData.coneMat.opacity = opacity * 0.45;
    // Aim the light at the road ahead of the player car, not at the camera —
    // ahead means along the car's heading, so the beam pool lands on the
    // road in front of it whichever way it is driving.
    const aheadX = Math.sin(state.player.heading) * 10;
    const aheadZ = Math.cos(state.player.heading) * 10;
    actors.heli.userData.spot.target.position.set(
      state.player.x + aheadX - state.heli.x, -42, state.player.z + aheadZ - state.heli.z,
    );
  } else if (actors.heli) {
    actors.heli.visible = false;
  }
  // Roadblocks.
  (state.roadblocks ?? []).forEach((rb, i) => {
    const mesh = actors.roadblocks[i];
    if (!mesh) return;
    mesh.visible = true;
    mesh.position.set(rb.x, 0, rb.z);
    mesh.rotation.y = rb.heading;
  });
  for (let i = (state.roadblocks ?? []).length; i < actors.roadblocks.length; i += 1) {
    actors.roadblocks[i].visible = false;
  }
  // Water shimmer.
  r.water.material.opacity = 0.9 + Math.sin(state.playtime * 0.7) * 0.04;

  const cam = r.camera;
  cam.position.set(cameraPose.x, cameraPose.y, cameraPose.z);
  cam.lookAt(cameraPose.lookX, cameraPose.lookY, cameraPose.lookZ);
  cam.fov = cameraPose.fov ?? 58;
  cam.updateProjectionMatrix();
  r.renderer.setSize(window.innerWidth, window.innerHeight, false);
  r.renderer.render(r.scene, cam);
  return { night };
}

// Chase camera: behind and above the player (or their car/boat), looking
// slightly ahead of them. `distance` and `height` let a shot pull in close
// so the subject fills the frame — the v5 composition fix for shot 2. `side`
// shifts the camera sideways (positive = the player's right) for a
// three-quarter view that shows the car's sunlit flank, not just its rear.
export function chaseCamera(state, distance = 13, height = 6.5, fov = 58, side = 0) {
  const p = state.player;
  const back = p.heading + Math.PI;
  const x = p.x + Math.sin(back) * distance + Math.cos(p.heading) * side;
  const z = p.z + Math.cos(back) * distance - Math.sin(p.heading) * side;
  return {
    x, y: height, z,
    lookX: p.x + Math.sin(p.heading) * 6,
    lookY: 1.6,
    lookZ: p.z + Math.cos(p.heading) * 6,
    fov,
  };
}
