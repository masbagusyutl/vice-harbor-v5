// Vice Harbor v5 — the entrypoint handed to the grader.
// It copies this repository's game/ and screenshots/ into the output
// directory and writes dossier.json with the kit's vendored library, so the
// sealed scorer can check the game and the judge can read its summary.
// Run outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (v5: composition-only visual polish of the golden-hour harbor city;
// the entry itself is game/index.html, plain static files, no build step.)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (see the kit's gate reference): at most 4
// screenshots of 256 KiB each, at most 993 files and 48 MiB under game/,
// every game path under 1,000 bytes, all inside /output's own 1,000-entry
// and 64 MiB caps — the numbers below refuse an entry the scorer would.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
