/* ==========================================================================
   js/games/teleuty.js — мини-игра «Стрельба из лука» (телеуты).
   Файл самостоятельный: если блока игры на странице нет, скрипт молча выходит.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.querySelector('[data-game="teleuty"]');
  if (!root) return;

  var sky = root.querySelector('[data-sky]');
  var arrow = root.querySelector('[data-arrow]');
  var windEl = root.querySelector('[data-wind]');
  var powerInput = root.querySelector('[data-power]');
  var angleInput = root.querySelector('[data-angle]');
  var powerOut = root.querySelector('[data-power-out]');
  var angleOut = root.querySelector('[data-angle-out]');
  var shootBtn = root.querySelector('[data-shoot]');
  var resetBtn = root.querySelector('[data-reset]');
  var statusEl = root.querySelector('[data-status]');
  var logEl = root.querySelector('[data-log]');

  var FIELD = 10;      /* ширина поля в метрах */
  var TARGET = 7.5;    /* расстояние до центра мишени */
  var MAX_SHOTS = 3;
  var WIND_LIMIT = 2.5;
  var RINGS = [
    { radius: 0.16, points: 10 },
    { radius: 0.36, points: 9 },
    { radius: 0.62, points: 7 },
    { radius: 0.95, points: 5 }
  ];

  var state = { shots: [], wind: 0, busy: false };

  function num(value) {
    return value.toFixed(1).replace('.', ',');
  }

  function windText(wind) {
    if (Math.abs(wind) < 0.2) return 'Ветер: стих';
    return 'Ветер: ' + (wind > 0 ? 'попутный ' : 'встречный ') + num(Math.abs(wind)) + ' м/с';
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.toggle('mg__status--win', kind === 'win');
    statusEl.classList.toggle('mg__status--lose', kind === 'lose');
  }

  function newWind() {
    state.wind = Math.round((Math.random() * 2 - 1) * WIND_LIMIT * 10) / 10;
    windEl.textContent = windText(state.wind);
  }

  function rangeFor(power, angle) {
    var speed = power * 0.11;
    var rad = angle * Math.PI / 180;
    var range = speed * speed * Math.sin(2 * rad) / 9.8 + state.wind * 0.25;
    return Math.max(0.4, range);
  }

  function pointsFor(range) {
    var offset = Math.abs(range - TARGET);
    for (var i = 0; i < RINGS.length; i += 1) {
      if (offset <= RINGS[i].radius) return RINGS[i].points;
    }
    return 0;
  }

  function addMark(x, points) {
    var mark = document.createElement('span');
    mark.className = 'mg-arch__mark';
    mark.style.left = x + 'px';
    mark.style.bottom = '38%';
    mark.textContent = points > 0 ? String(points) : '×';
    sky.appendChild(mark);
  }

  function addLog(shotNumber, range, points) {
    var item = document.createElement('li');
    var strong = document.createElement('b');
    strong.textContent = points + ' очков';
    item.appendChild(document.createTextNode('Выстрел ' + shotNumber + ': '));
    item.appendChild(strong);
    item.appendChild(document.createTextNode(' · ' + num(range) + ' м'));
    logEl.appendChild(item);
  }

  function lockControls(locked) {
    powerInput.disabled = locked;
    angleInput.disabled = locked;
    shootBtn.disabled = locked;
  }

  function finish() {
    var total = state.shots.reduce(function (sum, shot) { return sum + shot.points; }, 0);
    lockControls(true);
    resetBtn.hidden = false;
    newWind();

    var verdict;
    if (total >= 25) verdict = 'Отличная стрельба!';
    else if (total >= 15) verdict = 'Хороший результат, но есть куда расти.';
    else verdict = 'Тренируйся — и мишень покорится.';

    setStatus('Все три подхода позади: ' + total + ' из 30 очков. ' + verdict, total >= 15 ? 'win' : 'lose');
  }

  function land(range, x) {
    var points = pointsFor(range);
    addMark(x, points);
    state.shots.push({ range: range, points: points });
    addLog(state.shots.length, range, points);

    if (state.shots.length >= MAX_SHOTS) {
      state.busy = false;
      finish();
      return;
    }

    state.busy = false;
    newWind();
    setStatus('Выстрелов осталось: ' + (MAX_SHOTS - state.shots.length) + '. Подстрой прицел и стреляй снова.');
    lockControls(false);
    arrow.style.opacity = '0';
  }

  function shoot() {
    if (state.busy || state.shots.length >= MAX_SHOTS) return;
    state.busy = true;
    lockControls(true);
    setStatus('Стрела в полёте…');

    var power = Number(powerInput.value);
    var angle = Number(angleInput.value);
    var range = rangeFor(power, angle);

    var width = sky.clientWidth;
    var height = sky.clientHeight;
    var startX = width * 0.05;
    var endX = Math.max(width * 0.02, Math.min(width * 0.99, width * range / FIELD));
    var dx = Math.max(10, endX - startX - 34); /* 34 px — длина стрелы: к точке приходит остриё */
    var peak = Math.max(12, Math.min(height * 0.55, Math.abs(dx) * Math.tan(angle * Math.PI / 180) * 0.35));
    var duration = 620 + Math.min(600, Math.abs(dx) * 0.5);

    arrow.style.opacity = '1';
    arrow.style.transform = 'translate(0px, 0px) rotate(0deg)';

    var startedAt = 0;

    function flight(now) {
      if (!startedAt) startedAt = now;
      var p = Math.min(1, (now - startedAt) / duration);
      var x = dx * p;
      var y = -4 * peak * p * (1 - p);
      var slope = -4 * peak * (1 - 2 * p);
      var deg = Math.atan2(slope, dx) * 180 / Math.PI;

      arrow.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + deg + 'deg)';

      if (p < 1) {
        requestAnimationFrame(flight);
      } else {
        land(range, endX);
      }
    }

    requestAnimationFrame(flight);
  }

  function reset() {
    state = { shots: [], wind: 0, busy: false };
    logEl.textContent = '';

    var marks = sky.querySelectorAll('.mg-arch__mark');
    for (var i = 0; i < marks.length; i += 1) {
      marks[i].parentNode.removeChild(marks[i]);
    }

    arrow.style.opacity = '0';
    arrow.style.transform = 'translate(0px, 0px) rotate(0deg)';

    powerInput.value = '60';
    angleInput.value = '30';
    powerOut.textContent = '60';
    angleOut.textContent = '30°';

    lockControls(false);
    resetBtn.hidden = true;
    newWind();
    setStatus('Выстрелов осталось: 3.');
  }

  powerInput.addEventListener('input', function () {
    powerOut.textContent = powerInput.value;
  });

  angleInput.addEventListener('input', function () {
    angleOut.textContent = angleInput.value + '°';
  });

  shootBtn.addEventListener('click', shoot);
  resetBtn.addEventListener('click', reset);

  reset();
})();
