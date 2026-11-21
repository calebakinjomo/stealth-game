// SHADOWLINE — best-stealth-game-20261121-1759 entry (make.fun, harness program/v1).
//
// A top-down stealth browser game: slip past guard patrols and their vision cones,
// collect intel, and reach the extraction point without being spotted. Static files
// only — game/index.html plus its ES modules, no library, no network request — so a
// desktop browser loads it offline. This entrypoint copies game/ and screenshots/
// from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, via the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Guard: refuse to hand in a broken bundle. The game entrypoint and at least one
// screenshot must exist before anything is copied, so a missing file fails loudly
// here instead of shipping an empty /output to the judge.
const gameEntry = join(here, 'game', 'index.html');
if (!existsSync(gameEntry)) {
  throw new Error(`SHADOWLINE entrypoint missing: ${gameEntry} does not exist`);
}
const shotsDir = join(here, 'screenshots');
const shotFiles = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f))
  : [];
if (shotFiles.length === 0) {
  throw new Error(`SHADOWLINE screenshots missing: no PNG/JPEG found in ${shotsDir}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// Short summary of what was handed in, so a local run shows the bundle at a glance.
const countFiles = (dir: string): number =>
  readdirSync(dir, { withFileTypes: true }).reduce(
    (n, e) => n + (e.isDirectory() ? countFiles(join(dir, e.name)) : 1),
    0,
  );
const gameBytes = readdirSync(join(out, 'game'), { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .reduce((n, e) => n + statSync(join(e.parentPath, e.name)).size, 0);
console.log(
  `SHADOWLINE handed in: ${countFiles(join(out, 'game'))} game files (${gameBytes} bytes), ` +
    `${shotFiles.length} screenshot(s), dossier.json (${Buffer.byteLength(dossier, 'utf8')} bytes) -> ${out}`,
);
