/* ==========================================================================
   js/games/russkie.js — мини-игра «Городки» (русские).
   Файл самостоятельный: если блока игры на странице нет, скрипт молча выходит.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.querySelector('[data-game="russkie"]');
  if (!root) return;

  var field = root.querySelector('[data-field]');
  var figure = root.querySelector('[data-figure]');
  var blocks = root.querySelectorAll('.mg-gor__block');
  var aim = root.querySelector('[data-aim]');
  var bat = root.querySelector('[data-bat]');
  var chargeFill = root.querySelector('[data-charge]');
  var batsEl = root.querySelector('[data-bats]');
  var scoreEl = root.querySelector('[data-score]');
  var figureNameEl = root.querySelector('[data-figure-name]');
  var statusEl = root.querySelector('[data-status]');
  var resetBtn = root.querySelector('[data-reset]');

  var MAX_BATS = 5;
  var TOTAL_BLOCKS = blocks.length;
  var MIN_POWER = 35;
  var MAX_POWER = 92;
  var CHARGE_SPEED = 52;   /* единиц шкалы в секунду */
  var AIM_STEP = 14;
  var BOX_W = 150;
  var BOX_H = 90;
  var BLOCK_W = 30;
  var BLOCK_H = 20;

  /* Расстановки: координаты левого верхнего угла дощечки в сетке 150 × 90. */
  var LAYOUTS = [
    { name: 'Пушка', cells: [[0, 64], [36, 64], [72, 64], [108, 64], [36, 34], [72, 34]] },
    { name: 'Звезда', cells: [[60, 0], [0, 35], [120, 35], [60, 70], [30, 52], [90, 52]] },
    { name: 'Колодец', cells: [[15, 0], [105, 0], [15, 35], [105, 35], [15, 70], [105, 70]] },
    { name: 'Часовые', cells: [[15, 5], [105, 5], [15, 65], [105, 65], [45, 35], [75, 35]] },
    { name: 'Артиллерия', cells: [[0, 60], [45, 60], [90, 60], [15, 20], [60, 20], [105, 20]] }
  ];

  var state = {
    bats: MAX_BATS,
    down: [],
    layout: -1,
    aimX: 0,
    aimY: 0,
    charge: 0,
    direction: 1,
    busy: false,
    over: false
  };
  var rafId = 0;
  var lastTime = 0;

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.toggle('mg__status--win', kind === 'win');
    statusEl.classList.toggle('mg__status--lose', kind === 'lose');
  }

  function plural(count, one, few, many) {
    var tail = count % 100;
    if (tail >= 11 && tail <= 14) return many;
    tail = count % 10;
    if (tail === 1) return one;
    if (tail >= 2 && tail <= 4) return few;
    return many;
  }

  function throwsText(count) {
    return count + ' ' + plural(count, 'бросок', 'броска', 'бросков');
  }

  /* --------------------------------------------------------------- Прицел */

  function setAim(x, y) {
    var width = field.clientWidth;
    var height = field.clientHeight;
    state.aimX = Math.max(6, Math.min(width - 6, x));
    state.aimY = Math.max(6, Math.min(height - 6, y));
    aim.style.left = state.aimX + 'px';
    aim.style.top = state.aimY + 'px';
  }

  function centerAim() {
    var fieldRect = field.getBoundingClientRect();
    var figureRect = figure.getBoundingClientRect();
    if (!fieldRect.width || !figureRect.width) return;
    setAim(
      figureRect.left - fieldRect.left + figureRect.width / 2,
      figureRect.top - fieldRect.top + figureRect.height / 2
    );
  }

  function updateInfo() {
    batsEl.textContent = String(state.bats);
    scoreEl.textContent = String(state.down.length);
    figureNameEl.textContent = '«' + LAYOUTS[state.layout].name + '»';
  }

  /* -------------------------------------------------------------- Фигура */

  function applyLayout() {
    var next = state.layout;
    while (LAYOUTS.length > 1 && next === state.layout) {
      next = Math.floor(Math.random() * LAYOUTS.length);
    }
    state.layout = next;

    var cells = LAYOUTS[next].cells;
    for (var i = 0; i < blocks.length; i += 1) {
      var cell = cells[i] || [0, 0];
      blocks[i].style.left = (cell[0] / BOX_W * 100) + '%';
      blocks[i].style.top = (cell[1] / BOX_H * 100) + '%';
    }
  }

  function knockBlock(index) {
    var block = blocks[index];
    block.style.setProperty('--dx', (Math.random() * 80 - 40).toFixed(0) + 'px');
    block.style.setProperty('--dy', (-20 - Math.random() * 40).toFixed(0) + 'px');
    block.style.setProperty('--rot', (Math.random() * 180 - 90).toFixed(0) + 'deg');
    block.classList.add('mg-gor__block--down');
    state.down.push(index);
  }

  /* ------------------------------------------------------------ Шкала силы */

  function startLoop() {
    if (!rafId) {
      lastTime = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function syncLoop() {
    if (state.over || root.offsetParent === null) {
      stopLoop();
      return;
    }
    startLoop();
  }

  function frame(now) {
    rafId = 0;

    if (root.offsetParent === null || state.over) {
      return;
    }

    if (!lastTime) lastTime = now;
    var dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;

    if (!state.busy && !state.over) {
      state.charge += state.direction * CHARGE_SPEED * dt;
      if (state.charge >= 100) {
        state.charge = 100;
        state.direction = -1;
      } else if (state.charge <= 0) {
        state.charge = 0;
        state.direction = 1;
      }
      chargeFill.style.width = state.charge.toFixed(1) + '%';
    }

    rafId = requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- Бросок */

  function throwBat(power) {
    if (state.busy || state.over) return;

    state.busy = true;

    var fieldRect = field.getBoundingClientRect();
    var batRect = bat.getBoundingClientRect();
    var startX = batRect.left - fieldRect.left + batRect.width / 2;
    var startY = batRect.top - fieldRect.top + batRect.height / 2;

    var targetX = state.aimX;
    var targetY = state.aimY;

    if (power < MIN_POWER) {
      targetX = startX + (targetX - startX) * 0.45;
      targetY = field.clientHeight * 0.86;
    } else if (power > MAX_POWER) {
      targetX = Math.min(field.clientWidth + 40, targetX + field.clientWidth * 0.18);
      targetY = field.clientHeight * 0.12;
    }

    var dx = targetX - startX;
    var dy = targetY - startY;
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;

    bat.style.opacity = '1';
    bat.style.transform = 'translate(0px, 0px) rotate(' + angle + 'deg)';

    function done() {
      bat.style.opacity = '0';
      bat.style.transform = 'translate(0px, 0px) rotate(' + angle + 'deg)';
      resolveThrow(power, targetX, targetY);
    }

    if (typeof bat.animate === 'function') {
      var animation = bat.animate(
        [
          { transform: 'translate(0px, 0px) rotate(' + angle + 'deg)' },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + angle + 'deg)' }
        ],
        { duration: 300, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' }
      );
      animation.onfinish = function () {
        animation.cancel();
        done();
      };
    } else {
      setTimeout(done, 300);
    }
  }

  function resolveThrow(power, targetX, targetY) {
    state.bats -= 1;
    updateInfo();

    if (power < MIN_POWER) {
      setStatus('Слабый бросок — бита не долетела до фигуры. Бит осталось: ' + state.bats + '.');
      afterThrow();
      return;
    }

    if (power > MAX_POWER) {
      setStatus('Перелёт — бита ушла выше фигуры. Бит осталось: ' + state.bats + '.');
      afterThrow();
      return;
    }

    var fieldRect = field.getBoundingClientRect();
    var figureWidth = figure.getBoundingClientRect().width;
    var hits = [];
    var knockRadius = Math.max(28, figureWidth * 0.32);

    for (var i = 0; i < blocks.length; i += 1) {
      if (state.down.indexOf(i) !== -1) continue;

      var rect = blocks[i].getBoundingClientRect();
      if (!rect.width) continue;

      var cx = rect.left - fieldRect.left + rect.width / 2;
      var cy = rect.top - fieldRect.top + rect.height / 2;
      var dist = Math.sqrt((targetX - cx) * (targetX - cx) + (targetY - cy) * (targetY - cy));

      if (dist <= knockRadius) hits.push({ index: i, dist: dist });
    }

    if (!hits.length) {
      setStatus('Мимо! Бита прошла рядом с фигурой. Бит осталось: ' + state.bats + '.');
      afterThrow();
      return;
    }

    hits.sort(function (a, b) { return a.dist - b.dist; });
    for (var h = 0; h < hits.length; h += 1) {
      knockBlock(hits[h].index);
    }

    updateInfo();

    if (state.down.length >= TOTAL_BLOCKS) {
      state.over = true;
      resetBtn.hidden = false;
      stopLoop();
      setStatus('Городок сбит! Все ' + TOTAL_BLOCKS + ' дощечек лежат. Понадобилось ' +
        throwsText(MAX_BATS - state.bats) + '.', 'win');
      return;
    }

    var knocked = hits.length;
    setStatus((knocked === 1 ? 'Сбита ' : 'Сбито ') + knocked + ' ' +
      plural(knocked, 'дощечка', 'дощечки', 'дощечек') + ', всего ' + state.down.length + ' из ' +
      TOTAL_BLOCKS + '. Бит осталось: ' + state.bats + '.');
    afterThrow();
  }

  function afterThrow() {
    if (state.over) return;

    if (state.bats <= 0) {
      state.over = true;
      resetBtn.hidden = false;
      stopLoop();
      setStatus('Биты закончились. Сбито ' + state.down.length + ' из ' + TOTAL_BLOCKS +
        ' дощечек. Попробуй ещё раз!', 'lose');
      return;
    }

    state.busy = false;
    state.charge = 0;
    state.direction = 1;
    chargeFill.style.width = '0%';
    syncLoop();
  }

  /* ------------------------------------------------------------- Управление */

  field.addEventListener('pointermove', function (event) {
    if (state.busy || state.over) return;
    var rect = field.getBoundingClientRect();
    setAim(event.clientX - rect.left - field.clientLeft, event.clientY - rect.top - field.clientTop);
  });

  field.addEventListener('pointerdown', function (event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();

    var rect = field.getBoundingClientRect();
    setAim(event.clientX - rect.left - field.clientLeft, event.clientY - rect.top - field.clientTop);
    field.focus({ preventScroll: true });
    throwBat(state.charge);
  });

  field.addEventListener('keydown', function (event) {
    if (event.code === 'Space' || event.key === 'Enter') {
      event.preventDefault();
      throwBat(state.charge);
      return;
    }

    var step = event.shiftKey ? AIM_STEP * 3 : AIM_STEP;
    var handled = true;

    if (event.key === 'ArrowUp') setAim(state.aimX, state.aimY - step);
    else if (event.key === 'ArrowDown') setAim(state.aimX, state.aimY + step);
    else if (event.key === 'ArrowLeft') setAim(state.aimX - step, state.aimY);
    else if (event.key === 'ArrowRight') setAim(state.aimX + step, state.aimY);
    else handled = false;

    if (handled) event.preventDefault();
  });

  resetBtn.addEventListener('click', reset);

  window.addEventListener('resize', function () {
    if (!state.busy && state.down.length === 0) centerAim();
    syncLoop();
  });

  window.addEventListener('hashchange', function () {
    if (!state.busy && state.down.length === 0) centerAim();
    syncLoop();
  });

  function reset() {
    state.bats = MAX_BATS;
    state.down = [];
    state.busy = false;
    state.over = false;
    state.charge = 0;
    state.direction = 1;
    stopLoop();

    for (var i = 0; i < blocks.length; i += 1) {
      blocks[i].classList.remove('mg-gor__block--down');
      blocks[i].style.removeProperty('--dx');
      blocks[i].style.removeProperty('--dy');
      blocks[i].style.removeProperty('--rot');
    }

    applyLayout();
    resetBtn.hidden = true;
    chargeFill.style.width = '0%';
    updateInfo();
    centerAim();
    setStatus('Кликни по фигуре, когда шкала силы окажется в зелёной зоне.');
    syncLoop();
  }

  reset();
})();