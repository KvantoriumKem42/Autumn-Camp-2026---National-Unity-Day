/* ==========================================================================
   js/games/kumandintsy.js — мини-игра «Кажык өрө чачары» (кумандинцы).
   Файл самостоятельный: если блока игры на странице нет, скрипт молча выходит.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.querySelector('[data-game="kumandintsy"]');
  if (!root) return;

  var field = root.querySelector('[data-field]');
  var toss = root.querySelector('[data-toss]');
  var bones = Array.prototype.slice.call(root.querySelectorAll('[data-bone]'));
  var throwsEl = root.querySelector('[data-throws]');
  var scoreEl = root.querySelector('[data-score]');
  var takenEl = root.querySelector('[data-taken]');
  var statusEl = root.querySelector('[data-status]');
  var tossBtn = root.querySelector('[data-toss-btn]');
  var resetBtn = root.querySelector('[data-reset]');

  var MAX_THROWS = 5;
  var BASE_FLIGHT = 2500;   /* миллисекунд на первый бросок */
  var MIN_FLIGHT = 1300;
  var FLIGHT_STEP = 240;

  var state = {
    throwsLeft: MAX_THROWS,
    total: 0,
    taken: 0,
    flying: false,
    over: false,
    startedAt: 0,
    duration: BASE_FLIGHT,
    rafId: 0
  };

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

  function bonesText(count) {
    return count + ' ' + plural(count, 'кажык', 'кажыка', 'кажыков');
  }

  function updateInfo() {
    throwsEl.textContent = String(state.throwsLeft);
    scoreEl.textContent = String(state.total);
    takenEl.textContent = String(state.taken);
  }

  /* ---------------------------------------------------------- Подготовка */

  function prepareBones() {
    state.taken = 0;
    for (var i = 0; i < bones.length; i += 1) {
      bones[i].classList.remove('is-taken');
      bones[i].disabled = true;
    }
  }

  function enableBones() {
    for (var i = 0; i < bones.length; i += 1) {
      bones[i].disabled = false;
    }
  }

  function setAir(on) {
    state.flying = on;
    root.classList.toggle('is-air', on);
    toss.classList.toggle('is-flying', on);
    tossBtn.textContent = on ? 'Поймать' : 'Подбросить';
  }

  function clearToss() {
    toss.style.transform = '';
    toss.classList.remove('is-flying');
    root.classList.remove('is-air');
  }

  /* ------------------------------------------------------------- Полёт */

  function startFlight() {
    state.duration = Math.max(MIN_FLIGHT, BASE_FLIGHT - (MAX_THROWS - state.throwsLeft) * FLIGHT_STEP);
    state.startedAt = performance.now();
    setAir(true);
    state.rafId = requestAnimationFrame(frame);
  }

  function frame(now) {
    state.rafId = 0;

    if (!state.flying) return;

    var progress = Math.min(1, Math.max(0, (now - state.startedAt) / state.duration));
    var height = field.clientHeight * 0.6;
    var y = -4 * height * progress * (1 - progress);
    var rotation = progress * 540;

    toss.style.transform = 'translateY(' + y.toFixed(1) + 'px) rotate(' + rotation.toFixed(0) + 'deg)';

    if (progress >= 1) {
      land();
      return;
    }

    state.rafId = requestAnimationFrame(frame);
  }

  function stopFlight() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    state.flying = false;
  }

  /* ---------------------------------------------------------- Броски */

  function afterThrow() {
    updateInfo();

    if (state.over) return;

    if (state.throwsLeft <= 0) {
      state.over = true;
      tossBtn.disabled = true;
      resetBtn.hidden = false;

      if (state.total > 0) {
        setStatus('Броски закончились. Всего поймано ' + bonesText(state.total) + '.', 'win');
      } else {
        setStatus('Броски закончились. Ни одного кажыка не поймано — попробуй ещё раз!', 'lose');
      }
    }
  }

  function land() {
    var lost = state.taken;

    stopFlight();
    clearToss();
    prepareBones();
    tossBtn.textContent = 'Подбросить';

    if (lost > 0) {
      setStatus('Кость упала. Ты не поймал её, поэтому ' + bonesText(lost) + ' не засчитаны.', 'lose');
    } else {
      setStatus('Кость упала. В этот раз ты не взял ни одного кажыка.', 'lose');
    }

    state.taken = 0;
    afterThrow();
  }

  function catchBone() {
    if (!state.flying) return;

    stopFlight();
    clearToss();

    var caught = state.taken;

    if (caught > 0) {
      state.total += caught;
      setStatus('Поймал! В этот раз — ' + bonesText(caught) + '.', 'win');
    } else {
      setStatus('Кость поймана, но в руке не было кажыков. Бросок без очков.');
    }

    prepareBones();
    tossBtn.textContent = 'Подбросить';
    afterThrow();
  }

  function tossBone() {
    if (state.flying || state.over) return;

    state.throwsLeft -= 1;
    state.taken = 0;
    prepareBones();
    enableBones();
    updateInfo();

    tossBtn.textContent = 'Поймать';
    setStatus('Кость в воздухе — собирай кажыки и не забудь поймать её!');

    startFlight();
  }

  function grabBone(bone) {
    if (!state.flying || bone.classList.contains('is-taken')) return;

    bone.classList.add('is-taken');
    bone.disabled = true;
    state.taken += 1;
    updateInfo();

    setStatus('В руке ' + bonesText(state.taken) + '. Поймай кость, пока она не упала!');
  }

  /* --------------------------------------------------------- Управление */

  function abortFlight() {
    if (!state.flying) return;

    stopFlight();
    clearToss();

    state.throwsLeft += 1;
    state.taken = 0;
    prepareBones();
    tossBtn.textContent = 'Подбросить';
    updateInfo();
    setStatus('Бросок отменён. Нажми «Подбросить», чтобы начать снова.');
  }

  function reset() {
    stopFlight();
    clearToss();

    state.throwsLeft = MAX_THROWS;
    state.total = 0;
    state.taken = 0;
    state.over = false;
    state.duration = BASE_FLIGHT;

    tossBtn.textContent = 'Подбросить';
    tossBtn.disabled = false;
    resetBtn.hidden = true;

    prepareBones();
    updateInfo();
    setStatus('Нажми «Подбросить» — и собирай кажыки, пока кость летит.');
  }

  for (var i = 0; i < bones.length; i += 1) {
    bones[i].addEventListener('click', (function (bone) {
      return function () {
        grabBone(bone);
      };
    })(bones[i]));
  }

  tossBtn.addEventListener('click', function () {
    if (state.flying) {
      catchBone();
    } else {
      tossBone();
    }
  });

  resetBtn.addEventListener('click', reset);

  /* Пробел ловит кость, даже если фокус остался на поле. */
  document.addEventListener('keydown', function (event) {
    if (!state.flying || event.repeat) return;
    if (root.offsetParent === null) return;
    if (event.code === 'Space') {
      event.preventDefault();
      catchBone();
    }
  });

  window.addEventListener('hashchange', function () {
    abortFlight();
  });

  reset();
})();
