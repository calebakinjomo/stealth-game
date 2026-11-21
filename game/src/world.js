// The game's rules and state, with no drawing and no browser in it: the player,
// five patrolling guards with a full alert state machine, two sweeping cameras,
// artefacts, noise, the exit and the win/lose conditions. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react (sounds,
// announcements) without the world knowing about screens. Nothing here allocates
// after createWorld returns, except short-lived particle entries.

import {
  ARTEFACTS, ARTEFACTS_NEEDED, CAMERA, CAMERAS, DARK_ZONES, EXIT, FIELD,
  GUARD, GUARD_PATROLS, NOISE, PLAYER, PLAYER_SPAWN, STEP,
} from './config.js';
import { angleDiff, canSee, moveCircle, pointInRect } from './geometry.js';

export const EVENT_PICKUP = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;
export const EVENT_SUSPICIOUS = 16;
export const EVENT_DENIED = 32;

const GUARD_PATROL = 'patrol';
const GUARD_SUSPICIOUS = 'suspicious';
const GUARD_INVESTIGATE = 'investigate';
const GUARD_CHASE = 'chase';
const GUARD_SEARCH = 'search';
const GUARD_RETURN = 'return';

function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function createWorld(random) {
  const player = {
    x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, angle: -Math.PI / 2,
    sneak: false, sprint: false, moving: false,
  };
  const guards = GUARD_PATROLS.map((patrol, i) => {
    const start = patrol.waypoints[0];
    return {
      id: i, x: start.x, y: start.y, angle: 0, state: GUARD_PATROL,
      waypoint: 1, suspicion: 0, waitTimer: 0, stateTimer: 0,
      target: { x: start.x, y: start.y }, lastSeen: { x: 0, y: 0 },
      loseTimer: 0, scanDir: 1,
    };
  });
  const cameras = CAMERAS.map((c) => ({
    x: c.x, y: c.y, baseAngle: c.baseAngle, sweepArc: c.sweepArc,
    angle: c.baseAngle, suspicion: 0, time: random() * 10,
  }));
  const artefacts = ARTEFACTS.map((a) => ({ ...a, taken: false }));
  const particles = [];
  const state = {
    player, guards, cameras, artefacts, particles,
    collected: 0, elapsed: 0, status: 'playing',
    seenEver: false, spotCount: 0, alertLevel: 0,
    noiseLevel: 0, noiseTimer: 0, stepTimer: 0,
    message: '', messageTimer: 0,
    /** Seconds a guard keeps hunting after losing sight, per guard. */
    winTime: 0,
  };

  function reset() {
    player.x = PLAYER_SPAWN.x;
    player.y = PLAYER_SPAWN.y;
    player.angle = -Math.PI / 2;
    player.sneak = false;
    player.sprint = false;
    player.moving = false;
    for (let i = 0; i < guards.length; i += 1) {
      const g = guards[i];
      const start = GUARD_PATROLS[i].waypoints[0];
      g.x = start.x; g.y = start.y; g.angle = 0; g.state = GUARD_PATROL;
      g.waypoint = 1; g.suspicion = 0; g.waitTimer = 0; g.stateTimer = 0;
      g.target.x = start.x; g.target.y = start.y; g.loseTimer = 0;
    }
    for (const c of cameras) { c.suspicion = 0; c.angle = c.baseAngle; }
    for (const a of artefacts) a.taken = false;
    particles.length = 0;
    state.collected = 0;
    state.elapsed = 0;
    state.status = 'playing';
    state.seenEver = false;
    state.spotCount = 0;
    state.alertLevel = 0;
    state.noiseLevel = 0;
    state.noiseTimer = 0;
    state.stepTimer = 0;
    state.message = '';
    state.messageTimer = 0;
    state.winTime = 0;
  }

  function inDarkZone(x, y) {
    for (const z of DARK_ZONES) if (pointInRect(x, y, z)) return true;
    return false;
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const speed = 40 + random() * 110;
      particles.push({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 0.5 + random() * 0.4, maxLife: 0.9, color,
      });
    }
    if (particles.length > 220) particles.splice(0, particles.length - 220);
  }

  function showMessage(text, seconds = 2.6) {
    state.message = text;
    state.messageTimer = seconds;
  }

  /** Every guard and camera within `radius` of (x,y) goes to investigate it. */
  function hearNoise(x, y, radius) {
    for (const g of guards) {
      if (g.state === GUARD_CHASE) continue;
      if (dist(g.x, g.y, x, y) <= radius) {
        g.state = GUARD_INVESTIGATE;
        g.target.x = x; g.target.y = y;
        g.stateTimer = 0;
      }
    }
  }

  function moveToward(g, tx, ty, speed, dt) {
    const dx = tx - g.x;
    const dy = ty - g.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) return true;
    const stepLen = Math.min(d, speed * dt);
    const moved = moveCircle(g.x, g.y, GUARD.radius, (dx / d) * stepLen, (dy / d) * stepLen);
    g.x = moved.x;
    g.y = moved.y;
    g.angle = Math.atan2(dy, dx);
    return d <= speed * dt + 4;
  }

  function nearestWaypoint(g) {
    const patrol = GUARD_PATROLS[g.id].waypoints;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < patrol.length; i += 1) {
      const d = dist(g.x, g.y, patrol[i].x, patrol[i].y);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  function stepGuard(g, dt, events) {
    const patrol = GUARD_PATROLS[g.id].waypoints;
    const seen = canSee(g.x, g.y, g.angle, GUARD.viewRange, GUARD.viewHalfAngle, player.x, player.y);
    const d = dist(g.x, g.y, player.x, player.y);

    if (seen) {
      // How visible is the player right now?
      let visibility = 1 - (d / GUARD.viewRange) * 0.7;
      if (player.sneak) visibility *= PLAYER.sneakVisibility;
      if (player.sprint) visibility *= PLAYER.sprintVisibility;
      if (inDarkZone(player.x, player.y)) visibility *= 0.35;
      if (d < 55) visibility = Math.max(visibility, 1.4); // point-blank: no hiding.
      const before = g.suspicion;
      g.suspicion = Math.min(1, g.suspicion + GUARD.detectRate * visibility * dt);
      g.lastSeen.x = player.x;
      g.lastSeen.y = player.y;
      if (before < GUARD.suspectAt && g.suspicion >= GUARD.suspectAt && g.state !== GUARD_CHASE) {
        events |= EVENT_SUSPICIOUS;
      }
      if (g.suspicion >= GUARD.spotAt && g.state !== GUARD_CHASE) {
        g.state = GUARD_CHASE;
        g.loseTimer = GUARD.loseSightTime;
        state.seenEver = true;
        state.spotCount += 1;
        events |= EVENT_SPOTTED;
      }
    } else {
      g.suspicion = Math.max(0, g.suspicion - GUARD.decayRate * dt);
    }

    switch (g.state) {
      case GUARD_PATROL: {
        if (g.suspicion >= GUARD.suspectAt) {
          g.state = GUARD_SUSPICIOUS;
          g.stateTimer = 0.9;
          break;
        }
        if (g.waitTimer > 0) {
          g.waitTimer -= dt;
          g.angle += g.scanDir * 0.9 * dt; // look around while waiting.
          break;
        }
        const wp = patrol[g.waypoint];
        if (moveToward(g, wp.x, wp.y, GUARD.patrolSpeed, dt)) {
          g.waypoint = (g.waypoint + 1) % patrol.length;
          g.waitTimer = 1.2;
          g.scanDir = random() < 0.5 ? 1 : -1;
        }
        break;
      }
      case GUARD_SUSPICIOUS: {
        // Freeze, stare at where the player was glimpsed, then go look.
        g.angle += angleDiff(Math.atan2(g.lastSeen.y - g.y, g.lastSeen.x - g.x), g.angle) * Math.min(1, dt * 6);
        g.stateTimer -= dt;
        if (g.stateTimer <= 0) {
          g.state = GUARD_INVESTIGATE;
          g.target.x = g.lastSeen.x;
          g.target.y = g.lastSeen.y;
        }
        break;
      }
      case GUARD_INVESTIGATE: {
        if (g.suspicion >= GUARD.suspectAt && canSee(g.x, g.y, g.angle, GUARD.viewRange, GUARD.viewHalfAngle, player.x, player.y)) {
          // Re-spotted on the way over: chase.
          g.state = GUARD_CHASE;
          g.loseTimer = GUARD.loseSightTime;
          break;
        }
        if (moveToward(g, g.target.x, g.target.y, GUARD.investigateSpeed, dt)) {
          g.state = GUARD_SEARCH;
          g.stateTimer = GUARD.searchTime;
        }
        break;
      }
      case GUARD_CHASE: {
        if (seen) g.loseTimer = GUARD.loseSightTime;
        else g.loseTimer -= dt;
        if (g.loseTimer <= 0) {
          g.state = GUARD_SEARCH;
          g.stateTimer = GUARD.searchTime;
          g.target.x = g.lastSeen.x;
          g.target.y = g.lastSeen.y;
          break;
        }
        moveToward(g, player.x, player.y, GUARD.chaseSpeed, dt);
        if (dist(g.x, g.y, player.x, player.y) <= GUARD.catchDistance) {
          state.status = 'caught';
          return EVENT_CAUGHT;
        }
        break;
      }
      case GUARD_SEARCH: {
        g.angle += g.scanDir * 1.4 * dt;
        g.stateTimer -= dt;
        if (g.stateTimer <= 0) {
          g.state = GUARD_RETURN;
        }
        break;
      }
      case GUARD_RETURN: {
        g.waypoint = nearestWaypoint(g);
        const wp = patrol[g.waypoint];
        if (moveToward(g, wp.x, wp.y, GUARD.patrolSpeed, dt)) {
          g.state = GUARD_PATROL;
          g.waitTimer = 0.6;
        }
        break;
      }
      default:
        break;
    }
    return events;
  }

  function stepCamera(c, dt, events) {
    c.time += dt;
    c.angle = c.baseAngle + Math.sin(c.time * (CAMERA.sweepSpeed * Math.PI / 180)) * (c.sweepArc * Math.PI / 180);
    const seen = canSee(c.x, c.y, c.angle, CAMERA.viewRange, CAMERA.viewHalfAngle, player.x, player.y);
    if (seen) {
      let visibility = 1 - (dist(c.x, c.y, player.x, player.y) / CAMERA.viewRange) * 0.6;
      if (player.sneak) visibility *= PLAYER.sneakVisibility;
      if (inDarkZone(player.x, player.y)) visibility *= 0.35;
      c.suspicion = Math.min(1, c.suspicion + CAMERA.detectRate * visibility * dt);
      if (c.suspicion >= 1) {
        // The camera trips the alarm: the nearest guard comes to check.
        let nearest = null;
        let nearestDist = Infinity;
        for (const g of guards) {
          if (g.state === GUARD_CHASE) continue;
          const d = dist(g.x, g.y, player.x, player.y);
          if (d < nearestDist) { nearestDist = d; nearest = g; }
        }
        if (nearest) {
          nearest.state = GUARD_INVESTIGATE;
          nearest.target.x = player.x;
          nearest.target.y = player.y;
          nearest.suspicion = Math.max(nearest.suspicion, 0.6);
        }
        c.suspicion = 0.55;
        state.seenEver = true;
        events |= EVENT_SPOTTED;
      }
    } else {
      c.suspicion = Math.max(0, c.suspicion - GUARD.decayRate * dt);
    }
    return events;
  }

  /**
   * One fixed step. `move` is a normalised {x, y} vector. `sfx` is the audio object
   * (or null when silent, e.g. screenshot staging).
   */
  function step(dt, move, sprint, sneak, sfx) {
    let events = 0;
    if (state.status !== 'playing') return events;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;

    // --- Player movement -------------------------------------------------
    player.sneak = sneak;
    player.sprint = sprint && !sneak;
    const speed = player.sneak ? PLAYER.sneakSpeed : player.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    player.moving = move.x !== 0 || move.y !== 0;
    if (player.moving) {
      const moved = moveCircle(player.x, player.y, PLAYER.radius, move.x * speed * dt, move.y * speed * dt);
      player.x = moved.x;
      player.y = moved.y;
      player.angle = Math.atan2(move.y, move.x);
      // Footsteps: the faster and louder the stance, the sooner the next step.
      state.stepTimer -= dt;
      if (state.stepTimer <= 0) {
        state.stepTimer = player.sneak ? 0.55 : player.sprint ? 0.26 : 0.42;
        if (sfx) sfx.step(player.sneak, player.sprint);
      }
      // Noise: sprinting carries; walking is only heard up close.
      state.noiseTimer -= dt;
      if (state.noiseTimer <= 0) {
        const radius = player.sprint ? NOISE.sprintRadius : player.sneak ? NOISE.sneakRadius : NOISE.walkRadius;
        if (radius > 0) {
          hearNoise(player.x, player.y, radius);
          state.noiseLevel = player.sprint ? 1 : 0.45;
        }
        state.noiseTimer = 0.45;
      }
    } else {
      state.noiseLevel = Math.max(0, state.noiseLevel - dt * 2.5);
    }

    // --- Guards and cameras ----------------------------------------------
    for (const g of guards) {
      events = stepGuard(g, dt, events);
      if (events & EVENT_CAUGHT) break;
    }
    if (!(events & EVENT_CAUGHT)) {
      for (const c of cameras) events = stepCamera(c, dt, events);
    }

    // --- Artefact pickup ---------------------------------------------------
    for (const a of artefacts) {
      if (!a.taken && dist(player.x, player.y, a.x, a.y) < 34) {
        a.taken = true;
        state.collected += 1;
        burst(a.x, a.y, '#facc15', 26);
        events |= EVENT_PICKUP;
        if (state.collected === ARTEFACTS_NEEDED) {
          showMessage('All artefacts stolen — get to the exit!', 3.2);
        } else {
          showMessage(`${a.name} stolen (${state.collected}/${ARTEFACTS_NEEDED})`);
        }
      }
    }

    // --- Exit ---------------------------------------------------------------
    if (pointInRect(player.x, player.y, EXIT)) {
      if (state.collected >= ARTEFACTS_NEEDED) {
        state.status = 'won';
        state.winTime = state.elapsed;
        burst(player.x, player.y, '#34d399', 40);
        events |= EVENT_WIN;
      } else if (!(events & EVENT_DENIED)) {
        showMessage(`Exit sealed — steal all ${ARTEFACTS_NEEDED} artefacts first (${state.collected}/${ARTEFACTS_NEEDED})`, 1.6);
        events |= EVENT_DENIED;
      }
    }

    // --- Alert level + particles --------------------------------------------
    let alert = 0;
    for (const g of guards) alert = Math.max(alert, g.suspicion);
    for (const c of cameras) alert = Math.max(alert, c.suspicion);
    state.alertLevel = alert;

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Keep the player inside the field as a last resort.
    player.x = Math.min(FIELD.width - 24 - PLAYER.radius, Math.max(24 + PLAYER.radius, player.x));
    player.y = Math.min(FIELD.height - 24 - PLAYER.radius, Math.max(24 + PLAYER.radius, player.y));
    return events;
  }

  /** Ghost rating for the win screen: never spotted is best. */
  function rating() {
    if (!state.seenEver) return 'GHOST';
    if (state.spotCount <= 1) return 'SHADOW';
    return 'LOUD';
  }

  reset();
  return { state, reset, step, rating, hearNoise, showMessage };
}
