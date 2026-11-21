# stealth-game

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/calebakinjomo/stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/calebakinjomo/stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

SHADOWLINE — a top-down stealth game set on the night shift at the Meridian Vault museum. Sneak past five patrolling guards and two sweeping security cameras, steal all three artefacts, and reach the exit unseen. Guards have visible vision cones, suspicion that builds as they glimpse you, and a full alert state machine: patrol, suspicious, investigate, chase, search, return. Sprint and they hear you; crouch in the dark patches and behind crates and they lose you. A ghost run — never spotted — earns the GHOST rating.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, just static files under `game/`.

## How to play

- **WASD / arrows** — move
- **Shift** — sprint (fast, but loud: guards hear you)
- **C** — sneak (slow, quiet, much harder to spot)
- **P** — pause · **R** — restart · **H** — how to play · **M** — mute

Yellow cones are guard vision; orange means a guard is suspicious, red means run. Dark floor patches hide you, crates and display cases block line of sight. Steal all 3 artefacts to unlock the green EXIT, then slip out.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hdavhdvz&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
