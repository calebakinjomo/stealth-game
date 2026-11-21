// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, how-to, play,
// paused, caught and won.
//
// ?seed=N fixes the random pattern. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_DENIED, EVENT_PICKUP, EVENT_SPOTTED, EVENT_SUSPICIOUS, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_HOWTO, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, performance.now());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let muted = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal all 3 artefacts, then reach the exit unseen.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WON : SCREEN_CAUGHT;
    if (won) {
      audio.win();
      if (!world.state.seenEver && (best === 0 || world.state.winTime < best)) {
        best = Math.floor(world.state.winTime);
        saveBest(best);
      }
      announce(`Clean getaway in ${Math.floor(world.state.winTime)} seconds. Rating ${world.rating()}.`);
    } else {
      audio.caught();
      announce(`Caught after ${Math.floor(world.state.elapsed)} seconds.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_HOWTO) {
      if (actions & (ACTION_CONFIRM | ACTION_PAUSE)) screen = SCREEN_TITLE;
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_RESTART) startGame();
      return;
    }
    if (screen === SCREEN_WON || screen === SCREEN_CAUGHT) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startGame();
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyH' && (screen === SCREEN_TITLE || screen === SCREEN_HOWTO)) {
      screen = screen === SCREEN_HOWTO ? SCREEN_TITLE : SCREEN_HOWTO;
      audio.unlock();
    } else if (event.code === 'KeyM') {
      muted = !audio.toggle();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
  });

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const move = input.move();
    const events = world.step(STEP, move, input.sprinting(), input.sneaking(), audio);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SPOTTED) audio.alert();
    if (events & EVENT_SUSPICIOUS) audio.suspicious();
    if (events & EVENT_DENIED) audio.denied();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_CAUGHT) endGame(false);
    else if (events & EVENT_PICKUP) {
      announce(`Artefact ${world.state.collected} of 3 stolen.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, now);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Shadowline. Press Space or click to start. H for how to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
