// The screenshot scenes behind ?shot=start|play|end. Each one is a real world state
// rendered by the real renderer: the start scene lets the guards patrol for a few
// seconds behind the title panel; the play scene stages the player crouched behind
// cover with a guard closing in and one artefact already stolen; the end scene is
// the win panel after a ghost run. The same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and
 * return the screen to draw over it and the best time to show.
 */
export function stageShot(name, world) {
  const s = world.state;
  if (name === 'play') {
    world.reset();
    // Let the patrols spread out for a while first.
    for (let i = 0; i < 10 / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false, false, null);
    // The player, crouched behind the crate row in the main hall.
    s.player.x = 336;
    s.player.y = 338;
    s.player.angle = Math.PI * 0.85;
    s.player.sneak = true;
    // One artefact already stolen.
    s.artefacts[0].taken = true;
    s.collected = 1;
    s.elapsed = 64;
    // The central guard has caught a glimpse and is turning to look.
    const g = s.guards[4];
    g.x = 408;
    g.y = 300;
    g.angle = Math.PI;
    g.state = 'suspicious';
    g.suspicion = 0.55;
    g.lastSeen.x = 336;
    g.lastSeen.y = 338;
    s.alertLevel = 0.55;
    s.message = 'Sun Disk stolen (1/3)';
    s.messageTimer = 2.6;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    world.reset();
    for (let i = 0; i < 8 / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false, false, null);
    for (const a of s.artefacts) a.taken = true;
    s.collected = 3;
    s.player.x = 1212;
    s.player.y = 648;
    s.player.angle = 0;
    s.status = 'won';
    s.winTime = 187;
    s.elapsed = 187;
    s.seenEver = false;
    s.spotCount = 0;
    return { screen: SCREEN_WON, best: 187 };
  }
  // start (default): guards patrol behind the title panel.
  world.reset();
  for (let i = 0; i < 6 / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false, false, null);
  return { screen: SCREEN_TITLE, best: 0 };
}
