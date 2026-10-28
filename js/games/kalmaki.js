/* ==========================================================================
   js/games/kalmaki.js — мини-игра «Конные скачки» (калмаки).
   Файл самостоятельный: если блока игры на странице нет, скрипт молча выходит.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.querySelector('[data-game="kalmaki"]');
  if (!root) return;

  var horseEls = root.querySelectorAll('[data-horse]');
  var distanceEl = root.querySelector('[data-distance]');
  var timeEl = root.querySelector('[data-time]');
  var speedFill = root.querySelector('[data-speed]');
  var staminaFill = root.querySelector('[data-stamina]');
  var statusEl = root.querySelector('[data-status]');
  var startBtn = root.querySelector('[data-start]');
  var tapBtn = root.querySelector('[data-tap]');
  var resetBtn = root.querySelector('[data-reset]');

  var LENGTH = 12;      /* вёрсты */
  var MAX_SPEED = 1.9;
  var RIVALS = [
    { base: 0.78, phase: 0.4 },
    { base: 0.84, phase: 2.1 },
    { base: 0.70, phase: 4.0 }
  ];
  var state = null;
  var rafId = 0;
  var lastTime = 0;

  function createState() {
    return {
      running: false,
      time: 0,
      positions: [0, 0, 0, 0],
      speed: 0,
      stamina: 100,
      lastTap: 0,
      finished: [false, false, false, false],
      results: []
    };
  }

  function num(value) {
    return value.toFixed(1).replace('.', ',');
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.toggle('mg__status--win', kind === 'win');
    statusEl.classList.toggle('mg__status--lose', kind === 'lose');
  }

  function render() {
    for (var i = 0; i < horseEls.length; i += 1) {
      var share = Math.min(1, state.positions[i] / LENGTH);
      horseEls[i].style.left = (3 + share * 90).toFixed(2) + '%';
    }

    distanceEl.textContent = num(Math.min(state.positions[0], LENGTH)) + ' / ' + LENGTH;
    timeEl.textContent = num(state.time);
    speedFill.style.width = Math.round(Math.min(1, state.speed / MAX_SPEED) * 100) + '%';
    staminaFill.style.width = Math.round(state.stamina) + '%';
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

    if (!state.running) return;

    step(dt);
    render();

    if (state.running) {
      rafId = requestAnimationFrame(frame);
    }
  }

  function step(dt) {
    state.time += dt;

    /* Выносливость восстанавливается, если не частить с тапами. */
    if (state.time - state.lastTap > 0.22) {
      state.stamina = Math.min(100, state.stamina + 18 * dt);
    }

    state.speed *= Math.exp(-1.9 * dt);
    if (state.stamina <= 0) {
      state.speed *= Math.exp(-1.2 * dt);
    }
    if (state.speed < 0.02) state.speed = 0;

    state.positions[0] += state.speed * dt;

    for (var i = 0; i < RIVALS.length; i += 1) {
      var rival = RIVALS[i];
      if (state.finished[i + 1]) continue;
      var pace = rival.base + 0.05 * Math.sin(state.time * 0.7 + rival.phase);
      state.positions[i + 1] += pace * dt;
    }

    for (var j = 0; j < state.positions.length; j += 1) {
      if (!state.finished[j] && state.positions[j] >= LENGTH) {
        state.positions[j] = LENGTH;
        finishHorse(j);
      }
    }
  }

  function finishHorse(index) {
    state.finished[index] = true;
    state.results.push(index);

    if (index === 0) {
      endRace();
      return;
    }

    if (state.results.length === 3 && !state.finished[0]) {
      endRace();
    }
  }

  function endRace() {
    state.running = false;
    stopLoop();
    render();

    tapBtn.disabled = true;
    resetBtn.hidden = false;
    startBtn.hidden = true;

    var place = state.finished[0] ? state.results.indexOf(0) + 1 : 4;
    var placeText = ['', 'первым', 'вторым', 'третьим', 'четвёртым'][place];
    var result = place === 1
      ? 'Победа! Ты пришёл к финишу первым за ' + num(state.time) + ' с.'
      : place === 4
        ? 'Соперники уже на финише. Твой заезд — четвёртое место.'
        : 'Ты финишировал ' + placeText + ' за ' + num(state.time) + ' с.';

    setStatus(result, place === 1 ? 'win' : place === 4 ? 'lose' : '');
  }

  function tap() {
    if (!state || !state.running) return;

    var tired = state.stamina <= 0;
    var impulse = tired ? 0.14 : 0.55;

    state.speed = Math.min(MAX_SPEED, state.speed + impulse);
    state.stamina = Math.max(0, state.stamina - (tired ? 0.6 : 2.4));
    state.lastTap = state.time;
    render();
  }

  function start() {
    state = createState();
    state.running = true;
    startBtn.disabled = true;
    tapBtn.disabled = false;
    resetBtn.hidden = true;
    setStatus('Заезд начался! Скачи в ритме и не загоняй лошадь.');
    render();
    startLoop();
    tapBtn.focus({ preventScroll: true });
  }

  startBtn.addEventListener('click', start);
  tapBtn.addEventListener('pointerdown', function (event) {
    if (event.button !== undefined && event.button !== 0) return;
    tap();
  });
  tapBtn.addEventListener('keydown', function (event) {
    if (event.code !== 'Space' && event.key !== 'Enter') return;
    event.preventDefault();
    tap();
  });
  tapBtn.addEventListener('click', function (event) {
    /* одиночный клик уже обработан pointerdown */
    event.preventDefault();
  });
  resetBtn.addEventListener('click', function () {
    state = createState();
    startBtn.hidden = false;
    startBtn.disabled = false;
    tapBtn.disabled = true;
    resetBtn.hidden = true;
    setStatus('Нажми «Начать заезд», а потом скачи в ритме.');
    render();
  });

  state = createState();
  render();
  setStatus('Нажми «Начать заезд», а потом скачи в ритме.');
})();
