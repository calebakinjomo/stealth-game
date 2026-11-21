// SHADOWLINE — tuning, palette and the hand-designed level.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size. All coordinates are in playfield pixels.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 155,
  sneakSpeed: 88,
  sprintSpeed: 235,
  /** Detection multiplier while crouched/sneaking. */
  sneakVisibility: 0.45,
  /** Detection multiplier while sprinting (loud and obvious). */
  sprintVisibility: 1.45,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  investigateSpeed: 105,
  chaseSpeed: 152,
  /** Vision range in pixels and half-angle of the cone, in radians. */
  viewRange: 235,
  viewHalfAngle: 0.56,
  /** How fast a guard's suspicion fills (per second) at point-blank, unobstructed. */
  detectRate: 1.9,
  /** Suspicion above this makes a guard leave patrol and investigate. */
  suspectAt: 0.35,
  /** Suspicion at 1.0 means spotted: the guard chases. */
  spotAt: 1.0,
  /** Suspicion decays this fast per second when the player is unseen. */
  decayRate: 0.35,
  /** Seconds a chasing guard keeps hunting after losing sight before searching. */
  loseSightTime: 2.6,
  /** Seconds spent searching the last known spot before returning to patrol. */
  searchTime: 3.5,
  /** Catching distance: a chasing guard this close ends the run. */
  catchDistance: 30,
};

export const CAMERA = {
  viewRange: 210,
  viewHalfAngle: 0.5,
  detectRate: 1.5,
  /** Degrees per second the camera sweeps. */
  sweepSpeed: 28,
  sweepArc: 55,
};

export const NOISE = {
  /** Sprinting is heard this far away. */
  sprintRadius: 190,
  /** Walking is heard this far away. */
  walkRadius: 55,
  /** Sneaking is silent. */
  sneakRadius: 0,
};

export const ARTEFACTS_NEEDED = 3;

export const PALETTE = {
  backdrop: '#07080d',
  floorA: '#171a24',
  floorB: '#141722',
  carpet: '#232030',
  carpetEdge: '#2e2a40',
  wall: '#3a4157',
  wallTop: '#4a5470',
  wallEdge: '#20242f',
  cover: '#2c3145',
  coverTop: '#3d4560',
  plant: '#1d3a26',
  plantTop: '#2a5238',
  darkZone: '#0c0e16',
  player: '#7dd3fc',
  playerDark: '#38bdf8',
  guard: '#f87171',
  guardBody: '#b91c1c',
  camera: '#fbbf24',
  coneCalm: 'rgba(250, 204, 21, 0.20)',
  coneSuspicious: 'rgba(251, 146, 60, 0.30)',
  coneAlert: 'rgba(239, 68, 68, 0.34)',
  artefact: '#facc15',
  artefactGlow: 'rgba(250, 204, 21, 0.45)',
  exit: '#34d399',
  exitGlow: 'rgba(52, 211, 153, 0.35)',
  text: '#e8ecf4',
  muted: '#9aa3b8',
  dim: '#6b7280',
  panel: 'rgba(10, 12, 20, 0.92)',
  panelEdge: '#3a4157',
  danger: '#ef4444',
  warn: '#f59e0b',
  ok: '#34d399',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best (fastest ghost) time is kept between visits (this browser only). */
export const BEST_KEY = 'shadowline.best';

// ---------------------------------------------------------------------------
// The level: the Meridian Vault museum, one floor, top-down.
// Walls block movement and sight. Cover blocks movement and sight.
// Dark zones halve how fast guards spot you while you stand in one.
// ---------------------------------------------------------------------------

export const WALLS = [
  // Outer shell.
  { x: 0, y: 0, w: 1280, h: 24 },
  { x: 0, y: 696, w: 1280, h: 24 },
  { x: 0, y: 0, w: 24, h: 720 },
  { x: 1256, y: 0, w: 24, h: 720 },
  // Gallery (top-left room) south wall, door gap x 300..380.
  { x: 24, y: 180, w: 276, h: 16 },
  { x: 380, y: 180, w: 180, h: 16 },
  // Vault (top-right room) west wall, door gap y 130..170.
  { x: 760, y: 24, w: 16, h: 106 },
  { x: 760, y: 170, w: 16, h: 90 },
  // Vault south wall, door gap x 980..1060.
  { x: 760, y: 260, w: 220, h: 16 },
  { x: 1060, y: 260, w: 196, h: 16 },
  // Storage (bottom-left room) north wall, door gap x 200..280.
  { x: 24, y: 440, w: 176, h: 16 },
  { x: 280, y: 440, w: 140, h: 16 },
  // Lobby (bottom-right room) west wall, door gap y 540..600.
  { x: 880, y: 440, w: 16, h: 100 },
  { x: 880, y: 600, w: 16, h: 96 },
  // Central pillar block in the main hall.
  { x: 600, y: 300, w: 120, h: 16 },
  // Vault inner divider, leaves a gap to slip around either end.
  { x: 980, y: 24, w: 16, h: 84 },
];

export const COVER = [
  // Gallery display plinths.
  { x: 130, y: 80, w: 70, h: 40, kind: 'case' },
  { x: 430, y: 80, w: 70, h: 40, kind: 'case' },
  // Main hall crates — the spine of cover across the open floor.
  { x: 150, y: 300, w: 64, h: 64, kind: 'crate' },
  { x: 250, y: 300, w: 64, h: 64, kind: 'crate' },
  { x: 470, y: 250, w: 64, h: 64, kind: 'crate' },
  { x: 640, y: 470, w: 72, h: 72, kind: 'crate' },
  { x: 740, y: 470, w: 72, h: 72, kind: 'crate' },
  // Vault display cases.
  { x: 830, y: 110, w: 90, h: 42, kind: 'case' },
  { x: 1090, y: 150, w: 90, h: 42, kind: 'case' },
  // Storage crates.
  { x: 90, y: 520, w: 72, h: 72, kind: 'crate' },
  { x: 300, y: 560, w: 72, h: 72, kind: 'crate' },
  // Lobby bench.
  { x: 1010, y: 500, w: 96, h: 40, kind: 'case' },
];

export const PLANTS = [
  { x: 640, y: 196, w: 44, h: 44 },
  { x: 60, y: 400, w: 44, h: 44 },
  { x: 1210, y: 300, w: 44, h: 44 },
  { x: 920, y: 640, w: 44, h: 44 },
];

export const DARK_ZONES = [
  { x: 40, y: 220, w: 210, h: 64, label: 'shadow' },
  { x: 880, y: 300, w: 190, h: 64, label: 'shadow' },
  { x: 420, y: 600, w: 220, h: 64, label: 'shadow' },
  { x: 1040, y: 470, w: 170, h: 56, label: 'shadow' },
  { x: 40, y: 40, w: 90, h: 120, label: 'shadow' },
];

export const ARTEFACTS = [
  { id: 0, name: 'Sun Disk', x: 300, y: 92 },
  { id: 1, name: 'Jade Falcon', x: 1090, y: 92 },
  { id: 2, name: 'Moon Opal', x: 220, y: 620 },
];

export const EXIT = { x: 1180, y: 600, w: 76, h: 96 };

export const PLAYER_SPAWN = { x: 70, y: 380 };

export const GUARD_PATROLS = [
  // Gallery guard.
  { waypoints: [{ x: 120, y: 100 }, { x: 480, y: 100 }, { x: 480, y: 150 }, { x: 120, y: 150 }] },
  // Main hall guard, long north-south sweep.
  { waypoints: [{ x: 620, y: 240 }, { x: 620, y: 400 }, { x: 900, y: 400 }, { x: 900, y: 240 }] },
  // Vault guard.
  { waypoints: [{ x: 840, y: 80 }, { x: 1180, y: 80 }, { x: 1180, y: 220 }, { x: 840, y: 220 }] },
  // Storage / lobby guard.
  { waypoints: [{ x: 500, y: 620 }, { x: 800, y: 620 }, { x: 800, y: 480 }, { x: 500, y: 480 }] },
  // Central hall guard, east-west sweep.
  { waypoints: [{ x: 420, y: 260 }, { x: 420, y: 380 }, { x: 700, y: 380 }, { x: 700, y: 260 }] },
];

export const CAMERAS = [
  // Over the main hall, sweeping the corridor.
  { x: 640, y: 196, baseAngle: Math.PI / 2, sweepArc: 55 },
  // Over the vault door, sweeping the entrance.
  { x: 1010, y: 280, baseAngle: -Math.PI / 2, sweepArc: 45 },
];

export const ROOM_LABELS = [
  { x: 292, y: 42, text: 'GALLERY' },
  { x: 1090, y: 42, text: 'THE VAULT' },
  { x: 222, y: 462, text: 'STORAGE' },
  { x: 1068, y: 462, text: 'LOBBY' },
  { x: 640, y: 210, text: 'MAIN HALL' },
];
