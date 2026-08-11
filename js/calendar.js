/**
 * TeamSync Phase 2 calendar.
 * Phase 3 will extend this from one selected date to multiple date/time candidates.
 */
(function initializeCalendar() {
  "use strict";

  const calendar = document.querySelector("[data-calendar]");

  if (!calendar) {
    window.TeamSyncCalendar = Object.freeze({ isAvailable: false });
    return;
  }

  const monthLabel = calendar.querySelector("#calendar-month");
  const grid = calendar.querySelector("#calendar-grid");
  const previousButton = calendar.querySelector("#calendar-previous");
  const nextButton = calendar.querySelector("#calendar-next");
  const selectedDateInput = document.querySelector("#selected-date");
  const selectedDateLabel = calendar.querySelector("#selected-date-label");
  const selectionPanel = calendar.querySelector("#calendar-selection");
  const scheduleError = document.querySelector("#schedule-error");

  const today = startOfDay(new Date());
  let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let selectedDate = null;

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function toIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatMonth(date) {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
    }).format(date);
  }

  function formatSelectedDate(date) {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(date);
  }

  function isSameDate(first, second) {
    return first && second && toIsoDate(first) === toIsoDate(second);
  }

  function isCurrentMonth(date) {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth()
    );
  }

  function createEmptyCell() {
    const cell = document.createElement("span");
    cell.className = "calendar-empty-cell";
    cell.setAttribute("aria-hidden", "true");
    return cell;
  }

  function createDayButton(date) {
    const button = document.createElement("button");
    const dayOfWeek = date.getDay();
    const isPast = date < today;
    const isToday = isSameDate(date, today);
    const isSelected = isSameDate(date, selectedDate);

    button.className = "calendar-day";
    button.type = "button";
    button.dataset.date = toIsoDate(date);
    button.textContent = String(date.getDate());
    button.setAttribute("aria-label", formatSelectedDate(date));
    button.setAttribute("aria-pressed", String(isSelected));

    if (dayOfWeek === 0) {
      button.classList.add("is-sunday");
    } else if (dayOfWeek === 6) {
      button.classList.add("is-saturday");
    }

    if (isToday) {
      button.classList.add("is-today");
      button.setAttribute("aria-current", "date");
    }

    if (isSelected) {
      button.classList.add("is-selected");
    }

    if (isPast) {
      button.disabled = true;
      button.classList.add("is-past");
      button.setAttribute("aria-label", `${formatSelectedDate(date)}、選択できません`);
    }

    button.addEventListener("click", function handleDateSelection() {
      selectDate(date);
    });

    button.addEventListener("keydown", handleDayKeydown);
    return button;
  }

  function render() {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const fragment = document.createDocumentFragment();

    monthLabel.textContent = formatMonth(visibleMonth);
    previousButton.disabled = isCurrentMonth(visibleMonth);
    grid.replaceChildren();

    for (let cellIndex = 0; cellIndex < totalCells; cellIndex += 1) {
      const dayNumber = cellIndex - firstDay + 1;

      if (dayNumber < 1 || dayNumber > daysInMonth) {
        fragment.append(createEmptyCell());
        continue;
      }

      fragment.append(createDayButton(new Date(year, month, dayNumber)));
    }

    grid.append(fragment);
  }

  function selectDate(date) {
    selectedDate = startOfDay(date);
    selectedDateInput.value = toIsoDate(selectedDate);
    selectedDateLabel.textContent = formatSelectedDate(selectedDate);
    selectionPanel.classList.add("has-selection");
    scheduleError.textContent = "";
    render();

    document.dispatchEvent(
      new CustomEvent("teamsync:datechange", {
        detail: { date: selectedDateInput.value },
      }),
    );
  }

  function clearSelection() {
    selectedDate = null;
    selectedDateInput.value = "";
    selectedDateLabel.textContent = "日付を選択してください";
    selectionPanel.classList.remove("has-selection");
    render();
  }

  function changeMonth(offset) {
    visibleMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1,
    );
    render();
  }

  function handleDayKeydown(event) {
    const offsets = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const offset = offsets[event.key];

    if (!offset) {
      return;
    }

    event.preventDefault();
    const focusedDate = new Date(`${event.currentTarget.dataset.date}T00:00:00`);
    const targetDate = new Date(
      focusedDate.getFullYear(),
      focusedDate.getMonth(),
      focusedDate.getDate() + offset,
    );

    if (targetDate < today) {
      return;
    }

    if (
      targetDate.getMonth() !== visibleMonth.getMonth() ||
      targetDate.getFullYear() !== visibleMonth.getFullYear()
    ) {
      visibleMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      render();
    }

    grid.querySelector(`[data-date="${toIsoDate(targetDate)}"]`)?.focus();
  }

  previousButton.addEventListener("click", function showPreviousMonth() {
    if (!isCurrentMonth(visibleMonth)) {
      changeMonth(-1);
    }
  });

  nextButton.addEventListener("click", function showNextMonth() {
    changeMonth(1);
  });

  render();

  window.TeamSyncCalendar = Object.freeze({
    isAvailable: true,
    getSelectedDate: function getSelectedDate() {
      return selectedDateInput.value || null;
    },
    clearSelection,
  });
})();
