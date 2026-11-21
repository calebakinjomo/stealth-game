// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Canvas 2D throughout: tiled museum floor, glowing
// vision cones raycast against the walls, a darkness layer with a pool of light
// around the player, and the HUD and panels. Text that holds a number is rebuilt
// only when the number changes, so a frame allocates nothing.

import {
  ARTEFACTS_NEEDED, CAMERA, COVER, DARK_ZONES, EXIT, FIELD, FONT, GUARD,
  PALETTE, PLAYER, PLANTS, ROOM_LABELS, WALLS,
} from './config.js';
import { rayDistance } from './geometry.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_HOWTO = 'howto';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WON = 'won';
export const SCREEN_CAUGHT = 'caught';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const CONE_RAYS = 26;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const darkCanvas = document.createElement('canvas');
  const darkCtx = darkCanvas.getContext('2d');
  const timerLabel = cachedLabel('');
  const alertLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    darkCanvas.width = FIELD.width;
    darkCanvas.height = FIELD.height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? weight + ' ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  // --- Level ----------------------------------------------------------------

  function drawFloor() {
    context.fillStyle = PALETTE.floorA;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Subtle checker tiles.
    context.fillStyle = PALETTE.floorB;
    const tile = 40;
    for (let ty = 0; ty < FIELD.height / tile; ty += 1) {
      for (let tx = 0; tx < FIELD.width / tile; tx += 1) {
        if ((tx + ty) % 2 === 0) context.fillRect(tx * tile, ty * tile, tile, tile);
      }
    }
    // Carpet runners in the rooms.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(60, 60, 460, 100);
    context.fillRect(820, 60, 380, 170);
    context.fillRect(60, 480, 320, 180);
    context.fillRect(920, 480, 300, 180);
    context.strokeStyle = PALETTE.carpetEdge;
    context.lineWidth = 2;
    context.strokeRect(60, 60, 460, 100);
    context.strokeRect(820, 60, 380, 170);
    context.strokeRect(60, 480, 320, 180);
    context.strokeRect(920, 480, 300, 180);
    // Dark zones: pools of shadow where guards spot you slower.
    for (const z of DARK_ZONES) {
      context.fillStyle = PALETTE.darkZone;
      context.fillRect(z.x, z.y, z.w, z.h);
    }
    // Room labels, faint on the floor.
    context.textBaseline = 'alphabetic';
    for (const label of ROOM_LABELS) {
      text(label.text, label.x, label.y, 15, 'rgba(154,163,184,0.35)', 'center', '600');
    }
  }

  function drawExit(state) {
    const open = state.collected >= ARTEFACTS_NEEDED;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 280);
    context.save();
    context.shadowColor = PALETTE.exit;
    context.shadowBlur = open ? 22 + pulse * 14 : 8;
    context.fillStyle = open ? PALETTE.exit : '#14532d';
    context.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    context.restore();
    context.strokeStyle = '#064e3b';
    context.lineWidth = 3;
    context.strokeRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    context.fillStyle = '#ecfdf5';
    text('EXIT', EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2 - 4, 22, '#ecfdf5', 'center', '800');
    text(open ? 'OPEN' : `${state.collected}/${ARTEFACTS_NEEDED}`, EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2 + 20, 14, '#d1fae5', 'center', '700');
  }

  function drawArtefacts(state, now) {
    for (const a of state.artefacts) {
      if (a.taken) continue;
      const bob = Math.sin(now / 350 + a.id * 2) * 3;
      const pulse = 0.6 + 0.4 * Math.sin(now / 240 + a.id);
      context.save();
      context.shadowColor = PALETTE.artefact;
      context.shadowBlur = 18 + pulse * 12;
      context.fillStyle = PALETTE.artefact;
      context.beginPath();
      context.moveTo(a.x, a.y - 14 + bob);
      context.lineTo(a.x + 11, a.y + bob);
      context.lineTo(a.x, a.y + 14 + bob);
      context.lineTo(a.x - 11, a.y + bob);
      context.closePath();
      context.fill();
      context.restore();
      context.fillStyle = '#fffbeb';
      context.beginPath();
      context.arc(a.x, a.y + bob, 3.5, 0, Math.PI * 2);
      context.fill();
      // A faint ring on the floor so the artefact reads at a glance.
      context.strokeStyle = PALETTE.artefactGlow;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(a.x, a.y, 24 + pulse * 4, 0, Math.PI * 2);
      context.stroke();
      text(a.name, a.x, a.y + 42, 13, PALETTE.artefact, 'center', '700');
    }
  }

  function drawCover() {
    for (const c of COVER) {
      context.fillStyle = PALETTE.cover;
      context.fillRect(c.x, c.y, c.w, c.h);
      context.fillStyle = PALETTE.coverTop;
      context.fillRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
      context.strokeStyle = '#171a24';
      context.lineWidth = 2;
      if (c.kind === 'crate') {
        context.beginPath();
        context.moveTo(c.x + 4, c.y + 4);
        context.lineTo(c.x + c.w - 4, c.y + c.h - 4);
        context.moveTo(c.x + c.w - 4, c.y + 4);
        context.lineTo(c.x + 4, c.y + c.h - 4);
        context.stroke();
      } else {
        context.strokeRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
        context.fillStyle = 'rgba(250,204,21,0.25)';
        context.fillRect(c.x + c.w / 2 - 6, c.y + c.h / 2 - 6, 12, 12);
      }
    }
    for (const p of PLANTS) {
      context.fillStyle = PALETTE.plant;
      context.beginPath();
      context.arc(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.plantTop;
      context.beginPath();
      context.arc(p.x + p.w / 2 - 4, p.y + p.h / 2 - 4, p.w / 4, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(p.x + p.w / 2 + 6, p.y + p.h / 2 + 5, p.w / 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawWalls() {
    for (const w of WALLS) {
      context.fillStyle = PALETTE.wallEdge;
      context.fillRect(w.x, w.y + 3, w.w, w.h);
      context.fillStyle = PALETTE.wall;
      context.fillRect(w.x, w.y, w.w, w.h);
      context.fillStyle = PALETTE.wallTop;
      if (w.h <= 24) context.fillRect(w.x, w.y, w.w, 4);
      else context.fillRect(w.x, w.y, 4, w.h);
    }
  }

  // --- Vision cones -----------------------------------------------------------

  function coneColor(suspicion, stateName) {
    if (stateName === 'chase') return PALETTE.coneAlert;
    if (suspicion >= 0.35 || stateName === 'investigate' || stateName === 'search') return PALETTE.coneSuspicious;
    return PALETTE.coneCalm;
  }

  function drawCone(x, y, angle, range, halfAngle, fill) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(x, y);
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const a = angle - halfAngle + (2 * halfAngle * i) / CONE_RAYS;
      const d = rayDistance(x, y, Math.cos(a), Math.sin(a), range);
      context.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    context.closePath();
    context.fill();
    // A soft bright edge along the cone's rim.
    context.strokeStyle = fill.replace(/0\.\d+\)$/, '0.55)');
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawGuards(state) {
    for (const g of state.guards) {
      drawCone(g.x, g.y, g.angle, GUARD.viewRange, GUARD.viewHalfAngle, coneColor(g.suspicion, g.state));
      // Body.
      context.save();
      context.shadowColor = PALETTE.guard;
      context.shadowBlur = g.state === 'chase' ? 16 : 6;
      context.fillStyle = PALETTE.guardBody;
      context.beginPath();
      context.arc(g.x, g.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.fillStyle = '#fecaca';
      context.beginPath();
      context.arc(g.x + Math.cos(g.angle) * 5, g.y + Math.sin(g.angle) * 5, 5, 0, Math.PI * 2);
      context.fill();
      // Facing tick.
      context.strokeStyle = '#fecaca';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(g.x, g.y);
      context.lineTo(g.x + Math.cos(g.angle) * 20, g.y + Math.sin(g.angle) * 20);
      context.stroke();
      // Suspicion arc above the guard.
      if (g.suspicion > 0.05) {
        context.strokeStyle = g.suspicion >= 1 ? PALETTE.danger : PALETTE.warn;
        context.lineWidth = 4;
        context.beginPath();
        context.arc(g.x, g.y, GUARD.radius + 9, -Math.PI / 2, -Math.PI / 2 + g.suspicion * Math.PI * 2);
        context.stroke();
      }
      // "?" while suspicious, "!" while chasing.
      if (g.state === 'chase') {
        text('!', g.x, g.y - GUARD.radius - 14, 22, PALETTE.danger, 'center', '900');
      } else if (g.state === 'suspicious' || g.state === 'investigate' || g.state === 'search') {
        text('?', g.x, g.y - GUARD.radius - 14, 20, PALETTE.warn, 'center', '900');
      }
    }
  }

  function drawCameras(state, now) {
    for (const c of state.cameras) {
      const alert = c.suspicion >= 0.5;
      drawCone(c.x, c.y, c.angle, CAMERA.viewRange, CAMERA.viewHalfAngle, alert ? PALETTE.coneAlert : 'rgba(251, 191, 36, 0.13)');
      context.fillStyle = '#1f2937';
      context.beginPath();
      context.arc(c.x, c.y, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = alert ? PALETTE.danger : PALETTE.camera;
      context.beginPath();
      context.arc(c.x, c.y, 5, 0, Math.PI * 2);
      context.fill();
      if (alert && Math.floor(now / 300) % 2 === 0) {
        text('!', c.x, c.y - 18, 18, PALETTE.danger, 'center', '900');
      }
    }
  }

  function drawPlayer(state, now) {
    const p = state.player;
    const blink = state.alertLevel > 0.85 && Math.floor(now / 120) % 2 === 0;
    if (!blink) {
      context.save();
      context.shadowColor = PALETTE.player;
      context.shadowBlur = 20;
      // Cloak: a triangle pointing where the player faces.
      context.fillStyle = p.sneak ? '#0369a1' : PALETTE.playerDark;
      context.beginPath();
      context.moveTo(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18);
      context.lineTo(p.x + Math.cos(p.angle + 2.5) * 13, p.y + Math.sin(p.angle + 2.5) * 13);
      context.lineTo(p.x + Math.cos(p.angle - 2.5) * 13, p.y + Math.sin(p.angle - 2.5) * 13);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(p.x, p.y, p.sneak ? 10 : PLAYER.radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
      // Eyes in the facing direction.
      context.fillStyle = '#082f49';
      const ex = Math.cos(p.angle);
      const ey = Math.sin(p.angle);
      context.beginPath();
      context.arc(p.x + ex * 5 - ey * 4, p.y + ey * 5 + ex * 4, 2, 0, Math.PI * 2);
      context.arc(p.x + ex * 5 + ey * 4, p.y + ey * 5 - ex * 4, 2, 0, Math.PI * 2);
      context.fill();
    }
    // Detection meter over the player when anyone is onto them.
    if (state.alertLevel > 0.05) {
      const w = 46;
      const x = p.x - w / 2;
      const y = p.y - PLAYER.radius - 18;
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.fillRect(x - 1, y - 1, w + 2, 8);
      context.fillStyle = state.alertLevel >= 1 ? PALETTE.danger : state.alertLevel >= 0.35 ? PALETTE.warn : PALETTE.artefact;
      context.fillRect(x, y, w * state.alertLevel, 6);
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawDarkness(state) {
    darkCtx.setTransform(1, 0, 0, 1, 0, 0);
    darkCtx.clearRect(0, 0, FIELD.width, FIELD.height);
    darkCtx.fillStyle = 'rgba(3, 5, 12, 0.38)';
    darkCtx.fillRect(0, 0, FIELD.width, FIELD.height);
    const p = state.player;
    const grad = darkCtx.createRadialGradient(p.x, p.y, 60, p.x, p.y, 310);
    grad.addColorStop(0, 'rgba(3,5,12,0)');
    grad.addColorStop(0.55, 'rgba(3,5,12,0.10)');
    grad.addColorStop(1, 'rgba(3,5,12,0.38)');
    darkCtx.globalCompositeOperation = 'destination-out';
    darkCtx.fillStyle = grad;
    darkCtx.fillRect(p.x - 310, p.y - 310, 620, 620);
    darkCtx.globalCompositeOperation = 'source-over';
    context.drawImage(darkCanvas, 0, 0);
    // Vignette.
    const vig = context.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    context.fillStyle = vig;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  // --- HUD --------------------------------------------------------------------

  function drawHud(state) {
    const now = state.elapsed;
    context.textBaseline = 'top';
    // Artefacts.
    for (let i = 0; i < ARTEFACTS_NEEDED; i += 1) {
      const x = 28 + i * 30;
      const y = 28;
      context.fillStyle = i < state.collected ? PALETTE.artefact : 'rgba(154,163,184,0.35)';
      context.beginPath();
      context.moveTo(x, y - 9);
      context.lineTo(x + 8, y);
      context.lineTo(x, y + 9);
      context.lineTo(x - 8, y);
      context.closePath();
      context.fill();
    }
    text(` ${state.collected}/${ARTEFACTS_NEEDED} artefacts`, 28 + ARTEFACTS_NEEDED * 30, 20, 18, PALETTE.text, 'left', '700');
    // Timer, centre.
    text(timerLabel(formatTime(now)), FIELD.width / 2, 20, 20, PALETTE.text, 'center', '700');
    // Alert level, right.
    const alertText = state.alertLevel >= 1 ? 'SPOTTED!' : state.alertLevel >= 0.35 ? 'SUSPICIOUS' : 'UNSEEN';
    const alertColor = state.alertLevel >= 1 ? PALETTE.danger : state.alertLevel >= 0.35 ? PALETTE.warn : PALETTE.ok;
    text(alertLabel(alertText), FIELD.width - 28, 20, 18, alertColor, 'right', '800');
    // Noise + stance, bottom-left.
    const stance = state.player.sneak ? 'SNEAKING — silent' : state.player.sprint ? 'SPRINTING — loud' : 'WALKING';
    text(stance, 28, FIELD.height - 30, 15, PALETTE.muted, 'left', '600');
    if (state.noiseLevel > 0.05) {
      const w = 90;
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(28, FIELD.height - 52, w, 7);
      context.fillStyle = state.noiseLevel > 0.8 ? PALETTE.danger : PALETTE.warn;
      context.fillRect(28, FIELD.height - 52, w * state.noiseLevel, 7);
      text('NOISE', 124, FIELD.height - 56, 12, PALETTE.muted, 'left', '700');
    }
    // Hint when the exit is sealed and the player is near it.
    text('WASD move · Shift sprint · C sneak · P pause', FIELD.width - 28, FIELD.height - 30, 14, PALETTE.dim, 'right');
    // Toast message.
    if (state.messageTimer > 0 && state.message) {
      context.textBaseline = 'alphabetic';
      const alpha = Math.min(1, state.messageTimer);
      context.globalAlpha = alpha;
      context.fillStyle = PALETTE.panel;
      const w = context.measureText(state.message).width + 36;
      context.fillRect((FIELD.width - w) / 2, 64, w, 34);
      context.strokeStyle = PALETTE.panelEdge;
      context.strokeRect((FIELD.width - w) / 2, 64, w, 34);
      text(state.message, FIELD.width / 2, 87, 16, PALETTE.text, 'center', '600');
      context.globalAlpha = 1;
    }
  }

  // --- Panels -------------------------------------------------------------------

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, accent || PALETTE.text, 'center', '900');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.artefact, 'center', '700');
  }

  const TITLE_LINES = [
    'Night shift at the Meridian Vault. Three artefacts.',
    'Five guards. Two cameras. One way out.',
    'Stay out of the yellow cones. Crouch in the dark.',
    'Sprint and they will hear you.',
    '',
  ];
  const HOWTO_LINES = [
    'WASD / arrows — move        Shift — sprint (loud!)',
    'C — sneak (slow, quiet, harder to spot)',
    'Yellow cones are guard vision. Red means run.',
    'Dark floor patches hide you. Crates block sight.',
    'Steal all 3 artefacts, then reach the green EXIT.',
    'Cameras trip the alarm and send a guard to you.',
    'P — pause        R — restart        M — mute',
  ];
  const PAUSED_LINES = ['The guards will wait for you.'];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, now) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    drawExit(state);
    drawArtefacts(state, now);
    drawCover();
    drawWalls();
    drawCameras(state, now);
    drawGuards(state);
    drawPlayer(state, now);
    drawParticles(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_CAUGHT || screen === SCREEN_WON) {
      drawDarkness(state);
    }
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = best > 0 ? `Best ghost run: ${formatTime(best)}` : 'No ghost run yet — be the first.';
      drawPanel('SHADOWLINE', TITLE_LINES, 'Press Space or click to play  ·  H for how to play');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_HOWTO) {
      drawPanel('HOW TO PLAY', HOWTO_LINES, 'Press H or Space to go back');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_WON) {
      const rating = state.seenEver ? (state.spotCount <= 1 ? 'SHADOW' : 'LOUD') : 'GHOST';
      drawPanel('CLEAN GETAWAY', [
        `Time ${formatTime(state.winTime)}   ·   Artefacts ${state.collected}/${ARTEFACTS_NEEDED}`,
        `Spotted ${state.spotCount} time${state.spotCount === 1 ? '' : 's'} — rating: ${rating}`,
        rating === 'GHOST' ? 'Never seen. A perfect ghost.' : 'The vault remembers you — next time, stay unseen.',
        best > 0 && state.winTime <= best ? 'New best ghost time!' : '',
      ], 'Press Space to run it again', PALETTE.ok);
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel('CAUGHT', [
        `A guard got you after ${formatTime(state.elapsed)}.`,
        `Artefacts stolen: ${state.collected}/${ARTEFACTS_NEEDED}`,
        'The cones were there. Next time, wait for the gap.',
        '',
      ], 'Press Space or R to try again', PALETTE.danger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
