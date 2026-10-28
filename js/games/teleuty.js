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
  var bow = root.querySelector('[data-bow]');
  var targetEl = root.querySelector('[data-target]');
  var windEl = root.querySelector('[data-wind]');
  var powerInput = root.querySelector('[data-power]');
  var angleInput = root.querySelector('[data-angle]');
  var powerOut = root.querySelector('[data-power-out]');
  var angleOut = root.querySelector('[data-angle-out]');
  var shootBtn = root.querySelector('[data-shoot]');
  var resetBtn = root.querySelector('[data-reset]');
  var statusEl = root.querySelector('[data-status]');
  var logEl = root.querySelector('[data-log]');

  var FIELD = 10;          /* ширина поля в метрах */
  var TARGET = 7.5;        /* расстояние до плоскости мишени */
  var LAUNCH_X = 0.5;      /* где стоит лук */
  var G = 9.8;
  var FACE_R = 1.1;        /* радиус мишени в метрах */
  var WIND_LIMIT = 2.5;
  var WIND_DRIFT = 0.13;   /* снос в метрах за секунду при ветре 1 м/с */
  var MAX_SHOTS = 3;
  var RINGS = [
    { share: 0.16, points: 10 },
    { share: 0.36, points: 9 },
    { share: 0.62, points: 7 },
    { share: 0.92, points: 5 }
  ];

  var state = { shots: [], wind: 0, busy: false };

  function num(value) {
    return value.toFixed(1).replace('.', ',');
  }

  function windText(wind) {
    if (Math.abs(wind) < 0.2) return 'Ветер: стих';
    return 'Ветер: ' + (wind > 0 ? 'вправо ' : 'влево ') + num(Math.abs(wind)) + ' м/с';
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

  function updateBow() {
    bow.style.setProperty('--arch-angle', angleInput.value);
  }

  /* Полёт стрелы: где она окажется на плоскости мишени и куда упадёт. */
  function trajectory(power, angle) {
    var speed = power * 0.11;
    var rad = angle * Math.PI / 180;
    var vx = speed * Math.cos(rad);
    var vy = speed * Math.sin(rad);
    var distance = TARGET - LAUNCH_X;
    var flight = distance / vx;
    var height = vy * flight - 0.5 * G * flight * flight;
    var groundFlight = 2 * vy / G;
    var groundX = LAUNCH_X + vx * groundFlight;
    var range = speed * speed * Math.sin(2 * rad) / G;
    var drift = state.wind * flight * WIND_DRIFT;
    var apex = vy * vy / (2 * G);

    return {
      height: height,
      drift: drift,
      groundX: groundX,
      range: range,
      apex: apex
    };
  }

  function pointsFor(distancePx, faceRpx) {
    for (var i = 0; i < RINGS.length; i += 1) {
      if (distancePx <= RINGS[i].share * faceRpx) return RINGS[i].points;
    }
    return 0;
  }

  function addMark(x, y, points) {
    var mark = document.createElement('span');
    mark.className = 'mg-arch__mark';
    mark.style.left = x + 'px';
    mark.style.top = y + 'px';
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

  function land(points, range, x, y) {
    addMark(x, y, points);
    state.shots.push({ points: points, range: range });
    addLog(state.shots.length, range, points);

    if (state.shots.length >= MAX_SHOTS) {
      state.busy = false;
      finish();
      return;
    }

    state.busy = false;
    newWind();
    setStatus('Выстрелов осталось: ' + (MAX_SHOTS - state.shots.length) + '. Подстрой силу и угол.');
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
    var path = trajectory(power, angle);

    var skyRect = sky.getBoundingClientRect();
    var targetRect = targetEl.getBoundingClientRect();
    var width = skyRect.width;
    var height = skyRect.height;
    var faceRpx = targetRect.width / 2;
    var pxPerMeter = faceRpx / FACE_R;
    var centreX = targetRect.left - skyRect.left + targetRect.width / 2;
    var centreY = targetRect.top - skyRect.top + targetRect.height / 2;
    var groundY = height * 0.62;

    /* Положение стрелы на мишени: вбок сносит ветер, вверх-вниз — траектория. */
    var offsetX = path.drift * pxPerMeter;
    var offsetY = (path.height - FACE_R) * pxPerMeter;
    var shift = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    var points = pointsFor(shift, faceRpx);

    var hitX = centreX + offsetX;
    var hitY = centreY - offsetY;
    var endX = points > 0 ? hitX : Math.max(6, Math.min(width - 6, width * path.groundX / FIELD));
    var endY = points > 0 ? hitY : groundY;

    var startX = width * 0.05;
    var startY = groundY;
    var dx = Math.max(8, endX - startX - 32); /* 32 px — длина стрелы: к точке приходит остриё */
    var dy = endY - startY;
    var peak = Math.max(14, Math.min(height * 0.55, path.apex * pxPerMeter * 0.8 + Math.abs(dy) * 0.12));
    var duration = 620 + Math.min(520, Math.abs(dx) * 0.6);

    arrow.style.opacity = '1';
    arrow.style.transform = 'translate(0px, 0px) rotate(0deg)';

    var startedAt = 0;

    function flight(now) {
      if (!startedAt) startedAt = now;
      var p = Math.min(1, (now - startedAt) / duration);
      var x = dx * p;
      var y = dy * p - 4 * peak * p * (1 - p);
      var slope = dy - 4 * peak * (1 - 2 * p);
      var deg = Math.atan2(slope, dx) * 180 / Math.PI;

      arrow.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + deg + 'deg)';

      if (p < 1) {
        requestAnimationFrame(flight);
      } else {
        land(points, path.range, endX, endY);
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
    updateBow();

    lockControls(false);
    resetBtn.hidden = true;
    newWind();
    setStatus('Выстрелов осталось: 3. В центре мишени — 10 очков.');
  }

  powerInput.addEventListener('input', function () {
    powerOut.textContent = powerInput.value;
  });

  angleInput.addEventListener('input', function () {
    angleOut.textContent = angleInput.value + '°';
    updateBow();
  });

  shootBtn.addEventListener('click', shoot);
  resetBtn.addEventListener('click', reset);

  reset();
})();
