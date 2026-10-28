/* ==========================================================================
   cuisine.js — интерактив страницы «Кухня народов»
   Состояние хранится в sessionStorage: оценки, чек-листы и шаги.
   ========================================================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'cuisine-progress-v1';
  var RATING_LABELS = ['', 'Совсем не понравилось', 'Так себе', 'Нормально', 'Вкусно', 'Очень вкусно'];
  var dishes = Array.isArray(window.CUISINE_DISHES) ? window.CUISINE_DISHES : [];
  var grid = document.getElementById('dish-grid');
  var sortSelect = document.getElementById('dish-sort');

  if (!grid) {
    return;
  }

  if (!dishes.length) {
    grid.innerHTML = '<p class="cuisine-error">Не удалось загрузить рецепты. Обновите страницу.</p>';
    return;
  }

  var dishById = {};
  dishes.forEach(function (dish) {
    dishById[dish.id] = dish;
  });

  var state = loadState();

  function emptyState() {
    return { ratings: {}, progress: {}, sort: 'default' };
  }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : emptyState();
    } catch (error) {
      return emptyState();
    }
  }

  function normalizeState(value) {
    var result = emptyState();

    if (!value || typeof value !== 'object') {
      return result;
    }

    if (value.ratings && typeof value.ratings === 'object') {
      Object.keys(value.ratings).forEach(function (dishId) {
        var rating = Number(value.ratings[dishId]);
        if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
          result.ratings[dishId] = rating;
        }
      });
    }

    if (value.progress && typeof value.progress === 'object') {
      Object.keys(value.progress).forEach(function (dishId) {
        var progress = value.progress[dishId];
        if (!progress || typeof progress !== 'object') {
          return;
        }

        result.progress[dishId] = {
          ingredients: Array.isArray(progress.ingredients)
            ? progress.ingredients.filter(function (id) { return typeof id === 'string'; })
            : [],
          steps: Array.isArray(progress.steps)
            ? progress.steps.filter(function (id) { return typeof id === 'string'; })
            : [],
          cookCount: Number.isInteger(progress.cookCount) && progress.cookCount > 0
            ? progress.cookCount
            : 0
        };
      });
    }

    result.sort = value.sort === 'rating' ? 'rating' : 'default';

    return result;
  }

  function saveState() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      /* В приватном режиме sessionStorage может быть недоступен. */
    }
  }

  function progressFor(dish) {
    var progress = state.progress[dish.id];

    if (!progress) {
      progress = { ingredients: [], steps: [], cookCount: 0 };
      state.progress[dish.id] = progress;
    }

    var ingredientIds = dish.ingredients.map(function (ingredient) {
      return ingredient.id;
    });
    var stepIds = dish.steps.map(function (step) {
      return step.id;
    });

    progress.ingredients = progress.ingredients.filter(function (id) {
      return ingredientIds.indexOf(id) !== -1;
    });
    progress.steps = progress.steps.filter(function (id) {
      return stepIds.indexOf(id) !== -1;
    });

    if (!Number.isInteger(progress.cookCount) || progress.cookCount < 0) {
      progress.cookCount = 0;
    }

    return progress;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function plural(count, one, few, many) {
    var mod10 = count % 10;
    var mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) {
      return one;
    }

    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return few;
    }

    return many;
  }

  function servingsLabel(count) {
    return count + ' ' + plural(count, 'порция', 'порции', 'порций');
  }

  function formatMinutes(minutes) {
    if (minutes <= 0) {
      return '0 мин';
    }

    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;

    if (hours && rest) {
      return hours + ' ч ' + rest + ' мин';
    }

    if (hours) {
      return hours + ' ч';
    }

    return rest + ' мин';
  }

  function totalMinutes(dish) {
    return dish.steps.reduce(function (sum, step) {
      return sum + step.minutes;
    }, 0);
  }

  function remainingMinutes(dish, progress) {
    return dish.steps.reduce(function (sum, step) {
      return progress.steps.indexOf(step.id) === -1 ? sum + step.minutes : sum;
    }, 0);
  }

  function timeLabel(total, remaining, allDone) {
    if (allDone) {
      return 'Готово';
    }

    if (remaining < total) {
      return 'Осталось ' + formatMinutes(remaining);
    }

    return formatMinutes(total);
  }

  function ingredientCountLabel(progress, dish) {
    if (progress.ingredients.length === dish.ingredients.length) {
      return 'Все продукты отмечены';
    }

    return 'Отмечено: ' + progress.ingredients.length + ' из ' + dish.ingredients.length;
  }

  function statusText(progress, dish) {
    var total = dish.steps.length;
    var done = progress.steps.length;
    var remaining = remainingMinutes(dish, progress);
    var parts = [];

    if (done === total) {
      parts.push('Блюдо готово. Приятного аппетита!');
    } else if (done > 0) {
      parts.push('Выполнено ' + done + ' из ' + total + ' шагов. Осталось ' + formatMinutes(remaining) + '.');
    } else {
      parts.push('Отмечайте шаги — оставшееся время будет уменьшаться.');
    }

    if (progress.cookCount > 0) {
      parts.push('Приготовлено: ' + progress.cookCount + ' ' + plural(progress.cookCount, 'раз', 'раза', 'раз') + '.');
    }

    return parts.join(' ');
  }

  function creditHtml(dish) {
    var credit = dish.photoCredit;

    if (!credit) {
      return 'Фото: из архива проекта.';
    }

    if (!credit.url) {
      return escapeHtml(credit.text) + '.';
    }

    var result = 'Фото: <a href="' + escapeHtml(credit.url) + '" target="_blank" rel="noopener">' +
      escapeHtml(credit.text) + '</a>';

    if (credit.license) {
      result += credit.licenseUrl
        ? ', <a href="' + escapeHtml(credit.licenseUrl) + '" target="_blank" rel="noopener">' + escapeHtml(credit.license) + '</a>'
        : ', ' + escapeHtml(credit.license);
    }

    return result + '.';
  }

  function renderRating(dish) {
    var rating = state.ratings[dish.id] || 0;
    var stars = [1, 2, 3, 4, 5].map(function (value) {
      var filled = value <= rating;
      var label = value + ' из 5 — ' + RATING_LABELS[value];

      return '<label class="star' + (filled ? ' is-filled' : '') + '" title="' + escapeHtml(label) + '">' +
        '<input class="star__input" type="radio" name="rating-' + escapeHtml(dish.id) + '" value="' + value + '" data-rating="' + value + '"' + (value === rating ? ' checked' : '') + '>' +
        '<span class="star__icon" aria-hidden="true">★</span>' +
        '<span class="visually-hidden">' + escapeHtml(label) + '</span>' +
        '</label>';
    }).join('');

    return '<div class="dish-rating" role="group" aria-label="Ваша оценка блюда «' + escapeHtml(dish.name) + '»">' +
      '<span class="dish-rating__label">Ваша оценка</span>' +
      '<div class="dish-rating__stars">' + stars + '</div>' +
      '<span class="dish-rating__value" data-rating-value>' + (rating ? rating + ' из 5' : 'Не оценено') + '</span>' +
      '</div>';
  }

  function renderIngredients(dish, progress) {
    return dish.ingredients.map(function (ingredient) {
      var checked = progress.ingredients.indexOf(ingredient.id) !== -1;

      return '<li class="ingredient-list__item">' +
        '<label class="ingredient-check' + (checked ? ' is-checked' : '') + '">' +
        '<input type="checkbox" data-ingredient="' + escapeHtml(ingredient.id) + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="ingredient-check__box" aria-hidden="true"></span>' +
        '<span class="ingredient-check__name">' + escapeHtml(ingredient.name) + '</span>' +
        '<span class="ingredient-check__amount">' + escapeHtml(ingredient.amount) + '</span>' +
        '</label>' +
        '</li>';
    }).join('');
  }

  function renderSteps(dish, progress) {
    return dish.steps.map(function (step, index) {
      var done = progress.steps.indexOf(step.id) !== -1;

      return '<li class="step-list__item">' +
        '<button class="step' + (done ? ' is-done' : '') + '" type="button" data-step="' + escapeHtml(step.id) + '" aria-pressed="' + done + '">' +
        '<span class="step__num" aria-hidden="true">' + (index + 1) + '</span>' +
        '<span class="step__body">' +
        '<span class="step__title">' + escapeHtml(step.title) + '</span>' +
        '<span class="step__text">' + escapeHtml(step.text) + '</span>' +
        '</span>' +
        '<span class="step__time">' + formatMinutes(step.minutes) + '</span>' +
        '<span class="step__check" aria-hidden="true"></span>' +
        '</button>' +
        '</li>';
    }).join('');
  }

  function renderCard(dish) {
    var progress = progressFor(dish);
    var total = totalMinutes(dish);
    var remaining = remainingMinutes(dish, progress);
    var totalSteps = dish.steps.length;
    var doneSteps = progress.steps.length;
    var allDone = doneSteps === totalSteps;
    var preview = dish.ingredients.slice(0, 4).map(function (ingredient) {
      return ingredient.name;
    }).join(', ') + (dish.ingredients.length > 4 ? '…' : '');

    return '<article class="dish-card' + (allDone ? ' is-cooked' : '') + '" data-dish-id="' + escapeHtml(dish.id) + '">' +
      '<button class="dish-card__summary" type="button" aria-haspopup="dialog" aria-controls="dish-dialog-' + escapeHtml(dish.id) + '">' +
      '<span class="dish-card__media">' +
      '<img src="' + escapeHtml(dish.image) + '" alt="' + escapeHtml(dish.imageAlt) + '" width="' + dish.imageWidth + '" height="' + dish.imageHeight + '" loading="lazy">' +
      '<span class="dish-card__badge">' + escapeHtml(dish.people) + '</span>' +
      '</span>' +
      '<span class="dish-card__content">' +
      '<span class="dish-card__title-row">' +
      '<span class="dish-card__title">' + escapeHtml(dish.name) + '</span>' +
      '<span class="dish-card__toggle-icon" aria-hidden="true"></span>' +
      '</span>' +
      '<span class="dish-card__meta">' +
      '<span class="dish-card__meta-item"><span class="dish-card__meta-icon" aria-hidden="true">◷</span><span data-time>' + timeLabel(total, remaining, allDone) + '</span></span>' +
      '<span class="dish-card__meta-item"><span class="dish-card__meta-icon" aria-hidden="true">◍</span>' + escapeHtml(servingsLabel(dish.servings)) + '</span>' +
      '<span class="dish-card__meta-item"><span class="dish-card__meta-icon" aria-hidden="true">⚖</span>' + escapeHtml(dish.yield) + '</span>' +
      '</span>' +
      '<span class="dish-card__desc">' + escapeHtml(dish.description) + '</span>' +
      '<span class="dish-card__preview"><strong>Состав:</strong> ' + escapeHtml(preview) + '</span>' +
      '<span class="dish-card__open-hint">Открыть рецепт</span>' +
      '</span>' +
      '</button>' +
      renderRating(dish) +
      '<dialog class="dish-modal" id="dish-dialog-' + escapeHtml(dish.id) + '" aria-labelledby="dish-dialog-title-' + escapeHtml(dish.id) + '">' +
      '<div class="dish-modal__head">' +
      '<div class="dish-modal__title-wrap">' +
      '<p class="dish-card__eyebrow">Пошаговый рецепт</p>' +
      '<h2 class="dish-card__body-title" id="dish-dialog-title-' + escapeHtml(dish.id) + '">' + escapeHtml(dish.name) + '</h2>' +
      '</div>' +
      '<button class="dish-modal__close" type="button" data-close-dialog aria-label="Закрыть рецепт">' +
      '<span aria-hidden="true">×</span>' +
      '</button>' +
      '</div>' +
      '<div class="dish-modal__content">' +
      '<div class="dish-card__yield">' +
      '<span><strong>Выход:</strong> ' + escapeHtml(dish.yield) + '</span>' +
      '<span><strong>Порции:</strong> ' + escapeHtml(servingsLabel(dish.servings)) + '</span>' +
      '</div>' +
      '<p class="dish-card__note">' + escapeHtml(dish.note) + '</p>' +
      '<div class="dish-card__progress">' +
      '<div class="dish-card__progress-row">' +
      '<span data-remaining-label>' + (allDone ? 'Всё готово' : 'Осталось: <strong data-remaining>' + formatMinutes(remaining) + '</strong>') + '</span>' +
      '<span data-step-count>' + doneSteps + ' из ' + totalSteps + ' шагов</span>' +
      '</div>' +
      '<div class="dish-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + totalSteps + '" aria-valuenow="' + doneSteps + '" aria-valuetext="' + doneSteps + ' из ' + totalSteps + ' шагов" aria-label="Выполнено шагов">' +
      '<span class="dish-progress__fill" data-progress-fill style="width:' + (totalSteps ? (doneSteps / totalSteps) * 100 : 0) + '%"></span>' +
      '</div>' +
      '</div>' +
      '<div class="dish-card__columns">' +
      '<section class="dish-ingredients" aria-labelledby="ingredients-title-' + escapeHtml(dish.id) + '">' +
      '<h3 class="dish-block-title" id="ingredients-title-' + escapeHtml(dish.id) + '">Ингредиенты</h3>' +
      '<p class="dish-block-hint">Отметьте продукты, которые уже есть.</p>' +
      '<ul class="ingredient-list">' + renderIngredients(dish, progress) + '</ul>' +
      '<p class="dish-ingredients__count" data-ingredient-count>' + ingredientCountLabel(progress, dish) + '</p>' +
      '</section>' +
      '<section class="dish-steps" aria-labelledby="steps-title-' + escapeHtml(dish.id) + '">' +
      '<h3 class="dish-block-title" id="steps-title-' + escapeHtml(dish.id) + '">Рецепт по шагам</h3>' +
      '<p class="dish-block-hint">Нажимайте на шаг, чтобы отметить его выполненным. Время будет уменьшаться.</p>' +
      '<ol class="step-list">' + renderSteps(dish, progress) + '</ol>' +
      '</section>' +
      '</div>' +
      '<div class="dish-card__footer">' +
      '<div class="dish-card__status-wrap">' +
      '<p class="dish-card__status" data-status aria-live="polite">' + escapeHtml(statusText(progress, dish)) + '</p>' +
      '<p class="dish-card__credit">' + creditHtml(dish) + '</p>' +
      '</div>' +
      '<button class="dish-reset" type="button" data-reset>Приготовить ещё раз</button>' +
      '</div>' +
      '</div>' +
      '</dialog>' +
      '</article>';
  }

  function updateRating(card, dish) {
    var rating = state.ratings[dish.id] || 0;
    var valueNode = card.querySelector('[data-rating-value]');

    card.querySelectorAll('[data-rating]').forEach(function (input) {
      var value = Number(input.value);
      input.checked = value === rating;

      var label = input.closest('.star');
      if (label) {
        label.classList.toggle('is-filled', value <= rating);
      }
    });

    if (valueNode) {
      valueNode.textContent = rating ? rating + ' из 5' : 'Не оценено';
    }
  }

  function updateCard(card) {
    var dish = dishById[card.getAttribute('data-dish-id')];

    if (!dish) {
      return;
    }

    var progress = progressFor(dish);
    var total = totalMinutes(dish);
    var remaining = remainingMinutes(dish, progress);
    var totalSteps = dish.steps.length;
    var doneSteps = progress.steps.length;
    var allDone = doneSteps === totalSteps;
    var timeNode = card.querySelector('[data-time]');
    var remainingLabel = card.querySelector('[data-remaining-label]');
    var stepCount = card.querySelector('[data-step-count]');
    var progressBar = card.querySelector('.dish-progress');
    var progressFill = card.querySelector('[data-progress-fill]');
    var ingredientCount = card.querySelector('[data-ingredient-count]');
    var status = card.querySelector('[data-status]');

    card.classList.toggle('is-cooked', allDone);

    if (timeNode) {
      timeNode.textContent = timeLabel(total, remaining, allDone);
    }

    if (remainingLabel) {
      remainingLabel.innerHTML = allDone
        ? 'Всё готово'
        : 'Осталось: <strong data-remaining>' + formatMinutes(remaining) + '</strong>';
    }

    if (stepCount) {
      stepCount.textContent = doneSteps + ' из ' + totalSteps + ' шагов';
    }

    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', String(doneSteps));
      progressBar.setAttribute('aria-valuetext', doneSteps + ' из ' + totalSteps + ' шагов');
    }

    if (progressFill) {
      progressFill.style.width = (totalSteps ? (doneSteps / totalSteps) * 100 : 0) + '%';
    }

    if (ingredientCount) {
      ingredientCount.textContent = ingredientCountLabel(progress, dish);
    }

    if (status) {
      status.textContent = statusText(progress, dish);
    }

    card.querySelectorAll('[data-step]').forEach(function (button) {
      var done = progress.steps.indexOf(button.getAttribute('data-step')) !== -1;
      button.classList.toggle('is-done', done);
      button.setAttribute('aria-pressed', String(done));
    });

    card.querySelectorAll('[data-ingredient]').forEach(function (input) {
      var checked = progress.ingredients.indexOf(input.getAttribute('data-ingredient')) !== -1;
      input.checked = checked;

      var label = input.closest('.ingredient-check');
      if (label) {
        label.classList.toggle('is-checked', checked);
      }
    });

    updateRating(card, dish);
  }

  var scrollLocks = 0;
  var previousBodyPadding = '';

  function lockPageScroll() {
    scrollLocks += 1;
    if (scrollLocks > 1) {
      return;
    }

    previousBodyPadding = document.body.style.paddingRight;
    var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.documentElement.classList.add('has-modal');

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = scrollbarWidth + 'px';
    }
  }

  function unlockPageScroll() {
    if (scrollLocks === 0) {
      return;
    }

    scrollLocks -= 1;

    if (scrollLocks > 0) {
      return;
    }

    document.documentElement.classList.remove('has-modal');
    document.body.style.paddingRight = previousBodyPadding;
  }

  function handleDialogClosed(dialog) {
    unlockPageScroll();

    var card = dialog.closest('.dish-card');
    if (!card) {
      return;
    }

    var summary = card.querySelector('.dish-card__summary');
    if (summary) {
      summary.focus({ preventScroll: true });
    }
  }

  function openDialog(card) {
    var dialog = card.querySelector('.dish-modal');

    if (!dialog) {
      return;
    }

    updateCard(card);

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute('open', '');
    }

    lockPageScroll();

    var closeButton = dialog.querySelector('[data-close-dialog]');
    if (closeButton) {
      closeButton.focus();
    }
  }

  function closeDialog(dialog) {
    if (!dialog) {
      return;
    }

    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
      return;
    }

    dialog.removeAttribute('open');
    handleDialogClosed(dialog);
  }

  function setupDialogs() {
    grid.querySelectorAll('.dish-modal').forEach(function (dialog) {
      dialog.addEventListener('close', function () {
        handleDialogClosed(dialog);
      });

      dialog.addEventListener('click', function (event) {
        if (event.target !== dialog) {
          return;
        }

        var rect = dialog.getBoundingClientRect();
        var outside = event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom;

        if (outside) {
          closeDialog(dialog);
        }
      });
    });
  }

  function sortedDishes() {
    if (state.sort !== 'rating') {
      return dishes.slice();
    }

    return dishes.slice().sort(function (a, b) {
      var ratingA = state.ratings[a.id] || 0;
      var ratingB = state.ratings[b.id] || 0;

      if (ratingA !== ratingB) {
        return ratingB - ratingA;
      }

      return dishes.indexOf(a) - dishes.indexOf(b);
    });
  }

  function applySort() {
    sortedDishes().forEach(function (dish) {
      var card = grid.querySelector('.dish-card[data-dish-id="' + dish.id + '"]');
      if (card) {
        grid.appendChild(card);
      }
    });
  }

  function setRating(card, dish, value) {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return;
    }

    state.ratings[dish.id] = value;
    saveState();
    updateRating(card, dish);

    if (state.sort === 'rating') {
      applySort();
    }
  }

  function toggleIngredient(card, dish, ingredientId, checked) {
    var progress = progressFor(dish);
    var index = progress.ingredients.indexOf(ingredientId);

    if (checked && index === -1) {
      progress.ingredients.push(ingredientId);
    } else if (!checked && index !== -1) {
      progress.ingredients.splice(index, 1);
    }

    saveState();
    updateCard(card);
  }

  function toggleStep(card, dish, stepId) {
    var progress = progressFor(dish);
    var index = progress.steps.indexOf(stepId);

    if (index === -1) {
      progress.steps.push(stepId);
    } else {
      progress.steps.splice(index, 1);
    }

    saveState();
    updateCard(card);
  }

  function resetDish(card, dish) {
    var progress = progressFor(dish);

    progress.ingredients = [];
    progress.steps = [];
    progress.cookCount += 1;
    saveState();
    updateCard(card);
  }

  grid.addEventListener('click', function (event) {
    var closeButton = event.target.closest('[data-close-dialog]');

    if (closeButton) {
      closeDialog(closeButton.closest('.dish-modal'));
      return;
    }

    var resetButton = event.target.closest('[data-reset]');

    if (resetButton) {
      var resetCard = resetButton.closest('.dish-card');
      var resetDishData = dishById[resetCard.getAttribute('data-dish-id')];
      if (resetDishData) {
        resetDish(resetCard, resetDishData);
      }
      return;
    }

    var stepButton = event.target.closest('[data-step]');

    if (stepButton) {
      var stepCard = stepButton.closest('.dish-card');
      var stepDish = dishById[stepCard.getAttribute('data-dish-id')];
      if (stepDish) {
        toggleStep(stepCard, stepDish, stepButton.getAttribute('data-step'));
      }
      return;
    }

    var summary = event.target.closest('.dish-card__summary');

    if (summary) {
      openDialog(summary.closest('.dish-card'));
    }
  });

  grid.addEventListener('change', function (event) {
    var card = event.target.closest('.dish-card');

    if (!card) {
      return;
    }

    var dish = dishById[card.getAttribute('data-dish-id')];

    if (!dish) {
      return;
    }

    if (event.target.matches('[data-rating]')) {
      setRating(card, dish, Number(event.target.value));
      return;
    }

    if (event.target.matches('[data-ingredient]')) {
      toggleIngredient(card, dish, event.target.getAttribute('data-ingredient'), event.target.checked);
    }
  });

  grid.innerHTML = dishes.map(renderCard).join('');
  setupDialogs();

  if (sortSelect) {
    sortSelect.value = state.sort;
    sortSelect.addEventListener('change', function () {
      state.sort = sortSelect.value === 'rating' ? 'rating' : 'default';
      saveState();
      applySort();
    });
  }

  dishes.forEach(function (dish) {
    var card = grid.querySelector('[data-dish-id="' + dish.id + '"]');
    if (card) {
      updateCard(card);
    }
  });

  applySort();
}());
