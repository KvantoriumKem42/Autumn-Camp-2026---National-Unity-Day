/* ==========================================================================
   js/games/shorsy.js — мини-игра «Перетяни палку» (шорцы).
   Файл самостоятельный: если блока игры на странице нет, скрипт молча выходит.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.querySelector('[data-game="shorsy"]');
  if (!root) return;

  var field = root.querySelector('[data-field]');
  var powerFill = root.querySelector('[data-power]');
  var heatFill = root.querySelector('[data-heat]');
  var rivalFill = root.querySelector('[data-rival]');
  var statusEl = root.querySelector('[data-status]');
  var pullBtn = root.querySelector('[data-pull]');
  var resetBtn = root.querySelector('[data-reset]');

  var state;
  var rafId = 0;
  var lastTime = 0;

  function createState() {
    return {
      pos: 0,
      power: 0,
      heat: 0,
      holding: false,
      blocked: 0,
      burstNoticed: false,
      keyHeld: false,
      time: 0,
      over: false
    };
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.toggle('mg__status--win', kind === 'win');
    statusEl.classList.toggle('mg__status--lose', kind === 'lose');
  }

  function render() {
    field.style.setProperty('--sh-pos', (state.pos * 33).toFixed(2));
    powerFill.style.width = Math.round(state.power * 100) + '%';
    heatFill.style.width = Math.round(state.heat * 100) + '%';
    field.classList.toggle('mg-sh__field--pull', state.holding && !state.over && state.blocked <= 0);
    field.classList.toggle('mg-sh__field--blocked', state.blocked > 0);
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function startLoop() {
    if (!rafId) {
      lastTime = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  function frame(now) {
    rafId = 0;
    if (!lastTime) lastTime = now;
    var dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;

    step(dt);
    render();

    if (state.holding || state.power > 0.001 || state.heat > 0.001 || state.blocked > 0) {
      rafId = requestAnimationFrame(frame);
    }
  }

  function step(dt) {
    if (state.over) return;

    state.time += dt;

    if (state.blocked > 0) {
      state.blocked = Math.max(0, state.blocked - dt);
    }

    var holding = state.holding && state.blocked <= 0;

    if (holding) {
      state.power = Math.min(1, state.power + dt * 2);
      state.heat = Math.min(1, state.heat + dt * 0.32);

      if (state.heat >= 1) {
        state.blocked = 1.2;
        state.holding = false;
        holding = false;
        setStatus('Перегрев! Руки устали — переведи дух и снова тяни.');
      }
    } else {
      state.power = Math.max(0, state.power - dt * 2.5);
      state.heat = Math.max(0, state.heat - dt * 0.8);
    }

    /* Соперник тянет ровно, но раз в пять секунд делает рывок. */
    var cycle = state.time % 5;
    var burst = cycle > 3.3 && cycle < 4.4;

    if (burst && !state.burstNoticed) {
      state.burstNoticed = true;
      if (!state.over) setStatus('Соперник тянет сильнее! Держись.');
    }
    if (!burst) state.burstNoticed = false;

    var rival = 0.44 + 0.07 * Math.sin(state.time * 1.3) + 0.05 * Math.sin(state.time * 3.1) + (burst ? 0.45 : 0);
    var net = holding ? state.power * (1 - 0.45 * state.heat) - rival : -0.12;

    state.pos += net * 0.75 * dt;
    state.pos = Math.max(-1.15, Math.min(1.15, state.pos));
    rivalFill.style.width = Math.round(Math.min(1, rival) * 100) + '%';

    if (state.pos >= 1) {
      finish(true);
    } else if (state.pos <= -1) {
      finish(false);
    }
  }

  function finish(win) {
    state.over = true;
    state.holding = false;
    state.blocked = 0;
    stopLoop();
    render();

    pullBtn.disabled = true;
    resetBtn.hidden = false;

    if (win) {
      setStatus('Палка на твоей стороне — победа! Соперник остался ни с чем.', 'win');
    } else {
      setStatus('Соперник перетянул палку. Попробуй ещё раз — береги силы.', 'lose');
    }
  }

  function startPull() {
    if (!state || state.over) return;
    state.holding = true;
    startLoop();
  }

  function stopPull() {
    if (!state) return;
    state.holding = false;
  }

  function reset() {
    state = createState();
    pullBtn.disabled = false;
    resetBtn.hidden = true;
    setStatus('Держи кнопку и перетяни палку на свою сторону.');
    render();
  }

  pullBtn.addEventListener('pointerdown', function (event) {
    if (event.button !== undefined && event.button !== 0) return;
    startPull();
  });

  window.addEventListener('pointerup', stopPull);
  window.addEventListener('pointercancel', stopPull);

  pullBtn.addEventListener('keydown', function (event) {
    if (event.key !== ' ' && event.key !== 'Enter' && event.code !== 'Space') return;
    event.preventDefault();
    if (state.keyHeld) return;
    state.keyHeld = true;
    startPull();
  });

  pullBtn.addEventListener('keyup', function (event) {
    if (event.key !== ' ' && event.key !== 'Enter' && event.code !== 'Space') return;
    event.preventDefault();
    state.keyHeld = false;
    stopPull();
  });

  pullBtn.addEventListener('blur', function () {
    state.keyHeld = false;
    stopPull();
  });

  resetBtn.addEventListener('click', reset);

  reset();
})();
