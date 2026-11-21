// Geometry: collision and line-of-sight for the top-down level.
// Walls and cover are axis-aligned rectangles. All sight checks cast a segment
// against them, so a guard's cone stops at the first wall or crate it hits.

import { COVER, WALLS } from './config.js';

/** All sight-blocking rectangles: walls plus cover. */
export const BLOCKERS = [...WALLS, ...COVER];

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** True when the point is inside any wall or cover rectangle. */
export function pointBlocked(x, y) {
  for (let i = 0; i < BLOCKERS.length; i += 1) {
    if (pointInRect(x, y, BLOCKERS[i])) return true;
  }
  return false;
}

/**
 * Move a circle (centre x,y, radius r) by (dx,dy), sliding along walls: the new
 * position is pushed out of every blocker along the shortest axis (from the
 * closest point on the rectangle to the circle's centre), so the circle glides
 * around corners instead of wedging on them. Two passes settle corner cases.
 */
export function moveCircle(x, y, r, dx, dy) {
  let nx = x + dx;
  let ny = y + dy;
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < BLOCKERS.length; i += 1) {
      const b = BLOCKERS[i];
      const cx = Math.min(b.x + b.w, Math.max(b.x, nx));
      const cy = Math.min(b.y + b.h, Math.max(b.y, ny));
      const ddx = nx - cx;
      const ddy = ny - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 >= r * r) continue;
      if (d2 === 0) {
        // Centre inside the rectangle: push straight up out of it.
        ny = b.y - r;
      } else {
        const d = Math.sqrt(d2);
        let px = ddx / d;
        let py = ddy / d;
        // Knife-edge case: the push-out is purely horizontal (or vertical)
        // while the circle's centre sits within a radius of the rectangle's
        // perpendicular edge, so it can never slide around the corner — the
        // push keeps cancelling the movement exactly. Tilt the push in the
        // direction the circle is already trying to move (falling back to away
        // from the rectangle's centre when that component is zero), so the
        // circle glides around the corner instead of wedging on it. A flat
        // wall mid-face is untouched: the centre is far from its ends.
        if (py === 0 && (ny - b.y < r || b.y + b.h - ny < r)) {
          py = dy !== 0 ? Math.sign(dy) * 0.35 : (ny <= b.y + b.h / 2 ? -0.35 : 0.35);
        }
        if (px === 0 && (nx - b.x < r || b.x + b.w - nx < r)) {
          px = dx !== 0 ? Math.sign(dx) * 0.35 : (nx <= b.x + b.w / 2 ? -0.35 : 0.35);
        }
        if (px !== ddx / d || py !== ddy / d) {
          const len = Math.hypot(px, py);
          px /= len;
          py /= len;
        }
        nx = cx + px * r;
        ny = cy + py * r;
      }
    }
  }
  return { x: nx, y: ny };
}

/** Distance from (x0,y0) to the first blocker hit along direction (dx,dy), capped at max. */
export function rayDistance(x0, y0, dx, dy, max) {
  let best = max;
  for (let i = 0; i < BLOCKERS.length; i += 1) {
    const b = BLOCKERS[i];
    const t = rayRect(x0, y0, dx, dy, b);
    if (t !== null && t < best) best = t;
  }
  return best;
}

/** Slab-method ray vs rectangle. Returns the entry distance, or null when it misses. */
function rayRect(x0, y0, dx, dy, r) {
  let tmin = 0;
  let tmax = Infinity;
  if (dx === 0) {
    if (x0 < r.x || x0 > r.x + r.w) return null;
  } else {
    let t1 = (r.x - x0) / dx;
    let t2 = (r.x + r.w - x0) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (dy === 0) {
    if (y0 < r.y || y0 > r.y + r.h) return null;
  } else {
    let t1 = (r.y - y0) / dy;
    let t2 = (r.y + r.h - y0) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

/** True when the segment (x0,y0)-(x1,y1) crosses no wall or cover. */
export function hasLineOfSight(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return true;
  return rayDistance(x0, y0, dx / dist, dy / dist, dist) >= dist - 0.001;
}

/** Wrap an angle to (-PI, PI]. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when the target is inside a vision cone (range, half-angle) with clear sight. */
export function canSee(ox, oy, angle, range, halfAngle, tx, ty) {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist > 1 && Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfAngle) return false;
  return hasLineOfSight(ox, oy, tx, ty);
}
