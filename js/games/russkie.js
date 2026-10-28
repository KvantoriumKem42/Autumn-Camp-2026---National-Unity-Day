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
  var statusEl = root.querySelector('[data-status]');
  var throwBtn = root.querySelector('[data-throw]');
  var resetBtn = root.querySelector('[data-reset]');

  var MAX_BATS = 3;
  var TOTAL_BLOCKS = blocks.length;
  var MIN_POWER = 35;
  var MAX_POWER = 92;
  var CHARGE_SPEED = 90;   /* единиц шкалы в секунду */
  var AIM_STEP = 14;

  var state = {
    bats: MAX_BATS,
    down: [],
    aimX: 0,
    aimY: 0,
    charging: false,
    charge: 0,
    direction: 1,
    busy: false,
    over: false,
    keyHeld: false
  };
  var rafId = 0;
  var lastTime = 0;

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.toggle('mg__status--win', kind === 'win');
    statusEl.classList.toggle('mg__status--lose', kind === 'lose');
  }

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
  }

  function throwsText(count) {
    var tail = count % 10;
    var word = tail === 1 ? 'бросок' : tail >= 2 && tail <= 4 ? 'броска' : 'бросков';
    return count + ' ' + word;
  }

  /* ------------------------------------------------------------------ Заряд */

  function startCharge() {
    if (state.busy || state.over || state.charging) return;
    state.charging = true;
    state.charge = 0;
    state.direction = 1;
    chargeFill.style.width = '0%';
    startLoop();
  }

  function releaseCharge() {
    if (!state.charging) return;
    state.charging = false;
    var power = state.charge;
    state.charge = 0;
    chargeFill.style.width = '0%';
    throwBat(power);
  }

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

  function frame(now) {
    rafId = 0;
    if (!lastTime) lastTime = now;
    var dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;

    if (!state.charging) return;

    state.charge += state.direction * CHARGE_SPEED * dt;
    if (state.charge >= 100) {
      state.charge = 100;
      state.direction = -1;
    } else if (state.charge <= 0) {
      state.charge = 0;
      state.direction = 1;
    }

    chargeFill.style.width = state.charge.toFixed(1) + '%';
    rafId = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ Бросок */

  function throwBat(power) {
    if (state.busy || state.over) return;

    state.busy = true;
    throwBtn.disabled = true;

    var fieldRect = field.getBoundingClientRect();
    var batRect = bat.getBoundingClientRect();
    var startX = batRect.left - fieldRect.left + batRect.width / 2;
    var startY = batRect.top - fieldRect.top + batRect.height / 2;

    var targetX = state.aimX;
    var targetY = state.aimY;

    if (power < MIN_POWER) {
      targetX = startX + (targetX - startX) * 0.45;
      targetY = field.clientHeight * 0.82;
    } else if (power > MAX_POWER) {
      targetX = Math.min(field.clientWidth + 30, targetX + field.clientWidth * 0.18);
      targetY = field.clientHeight * 0.8;
    }

    var dx = targetX - startX;
    var dy = targetY - startY;
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;

    bat.style.opacity = '1';
    bat.style.transform = 'translate(0px, 0px) rotate(' + angle + 'deg)';

    function done() {
      bat.style.opacity = '0';
      bat.style.transform = 'translate(0px, 0px) rotate(' + angle + 'deg)';
      state.busy = false;
      resolveThrow(power);
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

  function resolveThrow(power) {
    state.bats -= 1;
    updateInfo();

    if (power < MIN_POWER) {
      setStatus('Слабый бросок — бита не долетела до городка. Бит осталось: ' + state.bats + '.');
      afterThrow();
      return;
    }

    if (power > MAX_POWER) {
      setStatus('Перелёт — бита ушла за фигуру. Бит осталось: ' + state.bats + '.');
      afterThrow();
      return;
    }

    var fieldRect = field.getBoundingClientRect();
    var figureRect = figure.getBoundingClientRect();

    if (!figureRect.width) {
      afterThrow();
      return;
    }

    var left = figureRect.left - fieldRect.left;
    var top = figureRect.top - fieldRect.top;
    var hit = state.aimX >= left - 8 && state.aimX <= left + figureRect.width + 8 &&
      state.aimY >= top - 8 && state.aimY <= top + figureRect.height + 8;

    if (!hit) {
      setStatus('Мимо! Бита прошла рядом с фигурой. Бит осталось: ' + state.bats + '.');
      afterThrow();
      return;
    }

    var centerX = left + figureRect.width / 2;
    var centerY = top + figureRect.height / 2;
    var offsetX = (state.aimX - centerX) / (figureRect.width / 2);
    var offsetY = (state.aimY - centerY) / (figureRect.height / 2);
    var distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    var count = Math.max(1, Math.round(TOTAL_BLOCKS * (1 - distance / 1.6)));

    var standing = [];
    for (var i = 0; i < blocks.length; i += 1) {
      if (state.down.indexOf(i) === -1) standing.push(i);
    }

    count = Math.min(count, standing.length);
    for (var j = standing.length - 1; j > 0; j -= 1) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = standing[j];
      standing[j] = standing[k];
      standing[k] = tmp;
    }

    for (var n = 0; n < count; n += 1) {
      knockBlock(standing[n]);
    }

    updateInfo();

    if (state.down.length >= TOTAL_BLOCKS) {
      state.over = true;
      resetBtn.hidden = false;
      throwBtn.disabled = true;
      setStatus('Городок сбит! Все ' + TOTAL_BLOCKS + ' чурок лежат. Понадобилось ' +
        throwsText(MAX_BATS - state.bats) + '.', 'win');
      return;
    }

    setStatus('Попадание! Сбито ' + count + ' — всего ' + state.down.length + ' из ' +
      TOTAL_BLOCKS + '. Бит осталось: ' + state.bats + '.');
    afterThrow();
  }

  function knockBlock(index) {
    var block = blocks[index];
    block.style.setProperty('--dx', (Math.random() * 80 - 40).toFixed(0) + 'px');
    block.style.setProperty('--dy', (-20 - Math.random() * 40).toFixed(0) + 'px');
    block.style.setProperty('--rot', (Math.random() * 180 - 90).toFixed(0) + 'deg');
    block.classList.add('mg-gor__block--down');
    state.down.push(index);
  }

  function afterThrow() {
    if (state.bats <= 0) {
      state.over = true;
      resetBtn.hidden = false;
      throwBtn.disabled = true;
      setStatus('Биты закончились. Сбито ' + state.down.length + ' из ' + TOTAL_BLOCKS +
        ' чурок. Попробуй ещё раз!', 'lose');
      return;
    }

    throwBtn.disabled = false;
  }

  /* -------------------------------------------------------------- Управление */

  field.addEventListener('pointermove', function (event) {
    var rect = field.getBoundingClientRect();
    setAim(event.clientX - rect.left, event.clientY - rect.top);
  });

  field.addEventListener('pointerdown', function (event) {
    var rect = field.getBoundingClientRect();
    setAim(event.clientX - rect.left, event.clientY - rect.top);
    field.focus({ preventScroll: true });
  });

  field.addEventListener('keydown', function (event) {
    var step = event.shiftKey ? AIM_STEP * 3 : AIM_STEP;
    var handled = true;

    if (event.key === 'ArrowUp') setAim(state.aimX, state.aimY - step);
    else if (event.key === 'ArrowDown') setAim(state.aimX, state.aimY + step);
    else if (event.key === 'ArrowLeft') setAim(state.aimX - step, state.aimY);
    else if (event.key === 'ArrowRight') setAim(state.aimX + step, state.aimY);
    else handled = false;

    if (handled) event.preventDefault();
  });

  throwBtn.addEventListener('pointerdown', function (event) {
    if (event.button !== undefined && event.button !== 0) return;
    startCharge();
  });

  window.addEventListener('pointerup', releaseCharge);
  window.addEventListener('pointercancel', releaseCharge);

  throwBtn.addEventListener('keydown', function (event) {
    if (event.code !== 'Space' && event.key !== 'Enter') return;
    event.preventDefault();
    if (state.keyHeld) return;
    state.keyHeld = true;
    startCharge();
  });

  throwBtn.addEventListener('keyup', function (event) {
    if (event.code !== 'Space' && event.key !== 'Enter') return;
    event.preventDefault();
    state.keyHeld = false;
    releaseCharge();
  });

  throwBtn.addEventListener('blur', function () {
    state.keyHeld = false;
    releaseCharge();
  });

  resetBtn.addEventListener('click', function () {
    state.bats = MAX_BATS;
    state.down = [];
    state.busy = false;
    state.over = false;
    state.charging = false;
    state.charge = 0;
    state.direction = 1;
    stopLoop();

    for (var i = 0; i < blocks.length; i += 1) {
      blocks[i].classList.remove('mg-gor__block--down');
      blocks[i].style.removeProperty('--dx');
      blocks[i].style.removeProperty('--dy');
      blocks[i].style.removeProperty('--rot');
    }

    throwBtn.disabled = false;
    resetBtn.hidden = true;
    chargeFill.style.width = '0%';
    updateInfo();
    centerAim();
    setStatus('Наведи прицел на фигуру, зажми «Бросок» и отпусти в рабочей зоне.');
  });

  window.addEventListener('resize', function () {
    if (!state.busy && state.down.length === 0) centerAim();
  });

  window.addEventListener('hashchange', function () {
    if (!state.busy && state.down.length === 0) centerAim();
  });

  updateInfo();
  centerAim();
})();
