/* ==========================================================================
   js/games/sibirskie-tatary.js — мини-игра «Куышу уены» (сибирские татары).
   Файл самостоятельный: если блока игры на странице нет, скрипт молча выходит.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.querySelector('[data-game="sibirskie-tatary"]');
  if (!root) return;

  var field = root.querySelector('[data-field]');
  var playerEl = root.querySelector('[data-player]');
  var chaserEl = root.querySelector('[data-chaser]');
  var caughtEl = root.querySelector('[data-caught]');
  var bestEl = root.querySelector('[data-best]');
  var statusEl = root.querySelector('[data-status]');
  var startBtn = root.querySelector('[data-start]');
  var resetBtn = root.querySelector('[data-reset]');
  var directionButtons = root.querySelectorAll('[data-dir]');

  var COLS = 9;
  var ROWS = 7;
  var START_PLAYER = { x: 4, y: 5 };
  var START_CHASER = { x: 4, y: 1 };
  var CHASER_STEP = 0.34;   /* секунды на клетку */
  var CHASER_GRACE = 0.9;
  var MOVE_COOLDOWN = 0.07;
  var DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  var KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    ц: 'up', ы: 'down', ф: 'left', в: 'right'
  };

  var best = 0;
  var caughtTotal = 0;
  var state = null;
  var rafId = 0;
  var lastTime = 0;

  function createState() {
    return {
      running: false,
      elapsed: 0,
      chaserClock: 0,
      moveClock: 0,
      player: { x: START_PLAYER.x, y: START_PLAYER.y },
      chaser: { x: START_CHASER.x, y: START_CHASER.y }
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
    playerEl.style.left = (state.player.x * 100 / COLS) + '%';
    playerEl.style.top = (state.player.y * 100 / ROWS) + '%';
    chaserEl.style.left = (state.chaser.x * 100 / COLS) + '%';
    chaserEl.style.top = (state.chaser.y * 100 / ROWS) + '%';
    caughtEl.textContent = String(caughtTotal);
    bestEl.textContent = best > 0 ? num(best) + ' с' : '—';
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

    state.elapsed += dt;
    state.moveClock = Math.max(0, state.moveClock - dt);
    state.chaserClock += dt;

    if (state.elapsed > CHASER_GRACE && state.chaserClock >= CHASER_STEP) {
      state.chaserClock = 0;
      moveChaser();
      if (sameCell()) {
        endRound();
        return;
      }
    }

    rafId = requestAnimationFrame(frame);
  }

  function sameCell() {
    return state.player.x === state.chaser.x && state.player.y === state.chaser.y;
  }

  function inside(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  }

  /* Волновой поиск пути: водящий идёт по кратчайшей дороге. */
  function moveChaser() {
    if (sameCell()) return;

    var queue = [{ x: state.chaser.x, y: state.chaser.y, first: null }];
    var seen = {};
    seen[state.chaser.x + ':' + state.chaser.y] = true;
    var dirs = [DIRECTIONS.up, DIRECTIONS.down, DIRECTIONS.left, DIRECTIONS.right];
    var head = 0;

    while (head < queue.length) {
      var cell = queue[head];
      head += 1;

      if (cell.x === state.player.x && cell.y === state.player.y) {
        if (cell.first) {
          state.chaser.x = cell.first.x;
          state.chaser.y = cell.first.y;
          render();
        }
        return;
      }

      for (var i = 0; i < dirs.length; i += 1) {
        var nx = cell.x + dirs[i].x;
        var ny = cell.y + dirs[i].y;
        var key = nx + ':' + ny;
        if (!inside(nx, ny) || seen[key]) continue;
        seen[key] = true;
        queue.push({
          x: nx,
          y: ny,
          first: cell.first || { x: nx, y: ny }
        });
      }
    }
  }

  function move(dirName) {
    if (!state || !state.running) return;
    if (state.moveClock > 0) return;

    var dir = DIRECTIONS[dirName];
    if (!dir) return;

    var nx = state.player.x + dir.x;
    var ny = state.player.y + dir.y;
    if (!inside(nx, ny)) return;

    state.moveClock = MOVE_COOLDOWN;
    state.player.x = nx;
    state.player.y = ny;
    render();

    if (sameCell()) endRound();
  }

  function start() {
    state = createState();
    state.running = true;
    startBtn.hidden = true;
    resetBtn.hidden = true;
    setStatus('Погоня началась! Уходи от водящего.');
    render();
    startLoop();
    field.focus({ preventScroll: true });
  }

  function endRound() {
    state.running = false;
    stopLoop();
    startBtn.hidden = false;
    resetBtn.hidden = false;
    caughtTotal += 1;

    var record = state.elapsed > best;
    if (record) best = state.elapsed;
    render();

    setStatus(
      (record ? 'Новый рекорд! ' : '') +
        'Водящий поймал тебя за ' + num(state.elapsed) + ' с. Попробуй продержаться дольше.',
      record ? 'win' : 'lose'
    );
  }

  function reset() {
    state = createState();
    startBtn.hidden = false;
    resetBtn.hidden = true;
    setStatus('Нажми «Начать погоню» и уходи от водящего.');
    render();
  }

  document.addEventListener('keydown', function (event) {
    if (!state || !state.running) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    var tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    var dir = KEYMAP[event.key] || KEYMAP[event.code];
    if (!dir) return;

    event.preventDefault();
    move(dir);
  });

  field.addEventListener('pointerdown', function () {
    field.focus({ preventScroll: true });
  });

  for (var i = 0; i < directionButtons.length; i += 1) {
    directionButtons[i].addEventListener('pointerdown', function (event) {
      event.preventDefault();
      move(this.getAttribute('data-dir'));
    });
  }

  startBtn.addEventListener('click', start);
  resetBtn.addEventListener('click', reset);

  state = createState();
  render();
  setStatus('Нажми «Начать погоню» и уходи от водящего.');
})();
