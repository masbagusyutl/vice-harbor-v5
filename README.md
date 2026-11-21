# VICE HARBOR

[![make.fun](https://make.fun/badge/competition/gta6-01)](https://make.fun/c/gta6-01)
[![make.fun](https://make.fun/badge/entry/vice-harbor-v5)](https://make.fun/c/gta6-01)
[![make.fun](https://make.fun/badge/live/vice-harbor-v5)](https://make.fun/c/gta6-01)

An original 3D open-world harbor-city crime game, built for the make.fun
**gta6-01 — Make GTA 6** competition. No Rockstar assets, no copied art or
code: the city, the people, the story and every line of code are original.

## The premise

Marco Solano came back to the harbor city with $150 and a stolen smile.
Seven jobs stand between him and the ferry out — if the crew, the cops and
the rivals let him live that long. Drive the golden-hour streets, steal
what you need, hold your turf, and get to the Port Azura ferry before the
city closes in.

## The cast

- **Marco Solano** — you. Driver, thief, and the new name on the Strip.
- **Marisol Vega** — getaway driver. Her cars handle 15% better.
- **Sam "Wrench" Okafor** — mechanic. Respray and repairs at half price.
- **Lena Cross** — hacker. Wanted heat fades twice as fast with her watching.
- **Captain Hale** — harbor master, keeper of the skiff and the crates.
- **Big Lou** — runs the Strip's turf and its gun shop.
- Rivals: **Roxy Rook**, **Diego Flint**, **Mira Solace** — each with their
  own car and their own idea of who owns the night races.

## The city — 10 districts

Port Azura · Neon Row · Calle Verde · The Docks · Marina Bay · Old Foundry ·
Palm Court · Ironworks · Sunset Strip · Coral Heights. Each district has
its own palette and neon signage; the harbor and marina lie along the south
edge, with a skiff, crates and the ferry.

## What is in the game

- **Open world on foot and by car** — third-person, enter and exit cars,
  steal traffic cars (the owner calls it in), 12 traffic cars on road loops,
  24 pedestrians, day–night cycle with a golden-hour default.
- **Wanted level 0–5** — stars rise on theft, speeding and hitting
  pedestrians, and fade when you keep clean. Police chase from 1 star,
  roadblocks from 3, a helicopter with a searchlight from 4.
- **7 story jobs** — First Light, Night Shift, Hot Wheels, Tide Runner,
  Sunset Sprint, Turf War, The Last Ferry — with dialogue, varied
  objectives and a JOB COMPLETE screen per job. Two jobs offer a branching
  choice with visible consequences (strip the Comet GT for parts, or pay
  the $500 harbor bribe).
- **3 street races** — Sunset Sprint vs Roxy Rook, Neon Loop vs Diego
  Flint, Harbor Grand Prix vs Mira Solace — checkpoints, live standings
  and cash prizes.
- **Taxi fares** — pick up a fare, drop them at the marker, get paid.
- **24 hidden harbor tokens** — scattered on the roads and the marina dock.
- **Turf control** — hold a corner for 5 quiet seconds to own it; owned
  turf pays $50 a minute.
- **A crew of 3** — recruited across the jobs, each with a real bonus.
- **Cash economy** — gun shop (pistol $200, ammo $40), respray garage
  ($100, half price with Sam), respect ranks from Rookie to Kingpin.
- **Boats** — Hale's skiff runs the harbor; one job is a crate recovery
  on the water.
- **HUD + live minimap** — cash, respect, wanted stars, clock, % COMPLETE,
  objective tracker, dialogue line and race standings.
- **Save / load** — progress autosaves on every completed job and on pause,
  and continues from the title screen.
- **Sound** — synthesized engine hum, police siren and pickup blips
  (WebAudio, no audio files). M mutes.

## Controls

| Key | Action |
|-----|--------|
| W A S D / arrows | Walk and drive (W accelerates, S brakes/reverses) |
| E | Enter / exit a car or a boat |
| F | Start the next job, or use a shop you are standing at |
| Space / mouse click | Shoot (once you own a pistol) |
| 1 / 2 | Answer a branching choice |
| P / Esc | Pause (shows % COMPLETE and lifetime stats) |
| M | Mute |

## How the checks run

The game logic lives in `game/src/sim.js` — pure JavaScript with no DOM
and no WebGL, so the same code runs in the browser and in Node.

- **Headless playthrough** — `node tools/playthrough.mjs` loads the sim
  and steps a scripted playthrough of the whole story: all 7 jobs, all 3
  races, all 24 tokens, turf, taxi, shops, wanted/police/roadblock/
  helicopter, the boat, save/load and determinism. It prints `PLAYTHROUGH:
  N passed, 0 failed` and exits non-zero on any failure. Run it twice:
  the run is deterministic for a fixed seed.
- **Screenshots** — `node tools/shots.mjs` serves `game/` locally, opens
  each scene from `shots.json` in headless desktop Chrome (1280×720),
  waits for `window.__shotReady`, and saves real renders of the running
  game as `screenshots/1-title.jpg` … `4-pause.jpg`. No mockups: every
  pixel comes from the game's own code.
- **Kit check** — from the unpacked kit:
  `node cli/makefun.mjs check --kit <kit> --repo <this repo> --worktree`.

## How to play locally

No build step. Serve `game/` with any static server and open
`game/index.html` in desktop Chrome, for example:

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080
```

## Files

- `game/index.html` — the page, HUD and overlays.
- `game/src/sim.js` — the whole game logic (world, jobs, races, wanted,
  economy, turf, boats). No DOM, no WebGL.
- `game/src/render.js` — the three.js scene: city, golden-hour lighting,
  wet neon streets, cars, pedestrians, helicopter, water.
- `game/src/main.js` — boot, input, HUD, minimap, save/load, game loop.
- `game/src/shots.js` — the four staged screenshot scenes.
- `game/src/audio.js` — synthesized sound.
- `game/vendor/three.module.min.js` — vendored three.js r160 (minified).
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes
  `dossier.json` with the kit's library.
- `tools/playthrough.mjs`, `tools/shots.mjs` — the checks above.
- `screenshots/` — four real renders of the running game.

## License

MIT — see `LICENSE`.
