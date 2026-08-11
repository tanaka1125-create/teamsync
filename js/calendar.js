/**
 * TeamSync Phase 3 calendar and candidate-time editor.
 * Event persistence will be connected to Supabase in Phase 4.
 */
(function initializeCalendar() {
  "use strict";

  const calendar = document.querySelector("[data-calendar]");

  if (!calendar) {
    window.TeamSyncCalendar = Object.freeze({ isAvailable: false });
    return;
  }

  const MAX_CANDIDATES = 10;
  const DEFAULT_START_TIME = "20:00";
  const DEFAULT_END_TIME = "22:00";

  const monthLabel = calendar.querySelector("#calendar-month");
  const grid = calendar.querySelector("#calendar-grid");
  const previousButton = calendar.querySelector("#calendar-previous");
  const nextButton = calendar.querySelector("#calendar-next");
  const selectionPanel = calendar.querySelector("#calendar-selection");
  const selectedCountLabel = calendar.querySelector("#selected-count-label");
  const candidateCount = document.querySelector("#candidate-count");
  const candidateEmpty = document.querySelector("#candidate-empty");
  const candidateList = document.querySelector("#candidate-list");
  const scheduleDataInput = document.querySelector("#schedule-data");
  const scheduleError = document.querySelector("#schedule-error");

  const today = startOfDay(new Date());
  const candidates = new Map();
  let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function toIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function fromIsoDate(isoDate) {
    return new Date(`${isoDate}T00:00:00`);
  }

  function formatMonth(date) {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
    }).format(date);
  }

  function formatCandidateDate(date) {
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

  function getSortedCandidates() {
    return Array.from(candidates.values()).sort((first, second) =>
      first.date.localeCompare(second.date),
    );
  }

  function getCandidates() {
    return getSortedCandidates().map((candidate) => ({ ...candidate }));
  }

  function createEmptyCell() {
    const cell = document.createElement("span");
    cell.className = "calendar-empty-cell";
    cell.setAttribute("aria-hidden", "true");
    return cell;
  }

  function createDayButton(date) {
    const button = document.createElement("button");
    const isoDate = toIsoDate(date);
    const dayOfWeek = date.getDay();
    const isPast = date < today;
    const isToday = isSameDate(date, today);
    const isSelected = candidates.has(isoDate);

    button.className = "calendar-day";
    button.type = "button";
    button.dataset.date = isoDate;
    button.textContent = String(date.getDate());
    button.setAttribute("aria-label", formatCandidateDate(date));
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
      button.setAttribute("aria-label", `${formatCandidateDate(date)}、選択中`);
    }

    if (isPast) {
      button.disabled = true;
      button.classList.add("is-past");
      button.setAttribute("aria-label", `${formatCandidateDate(date)}、選択できません`);
    }

    button.addEventListener("click", function handleDateSelection() {
      toggleDate(date);
      grid.querySelector(`[data-date="${isoDate}"]`)?.focus();
    });

    button.addEventListener("keydown", handleDayKeydown);
    return button;
  }

  function renderCalendar() {
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

  function formatTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function createTimeSelect(candidate, field, labelText, errorId) {
    const wrapper = document.createElement("label");
    const label = document.createElement("span");
    const select = document.createElement("select");
    const isEndTime = field === "endTime";
    const firstMinutes = isEndTime ? 30 : 0;
    const lastMinutes = isEndTime ? 24 * 60 : 23 * 60 + 30;

    wrapper.className = "time-field";
    label.textContent = labelText;
    select.className = "time-select";
    select.dataset.timeField = field;
    select.setAttribute(
      "aria-label",
      `${formatCandidateDate(fromIsoDate(candidate.date))}の${labelText}時刻`,
    );
    select.setAttribute("aria-describedby", errorId);

    for (let minutes = firstMinutes; minutes <= lastMinutes; minutes += 30) {
      const value = formatTime(minutes);
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === candidate[field];
      select.append(option);
    }

    select.addEventListener("change", function handleTimeChange() {
      candidate[field] = select.value;
      syncScheduleData();
      validateCandidate(candidate.date);
      dispatchScheduleChange();
    });

    wrapper.append(label, select);
    return wrapper;
  }

  function createCandidateCard(candidate, index) {
    const card = document.createElement("article");
    const header = document.createElement("div");
    const headingGroup = document.createElement("div");
    const candidateIndex = document.createElement("span");
    const dateHeading = document.createElement("h4");
    const removeButton = document.createElement("button");
    const timeRange = document.createElement("div");
    const separator = document.createElement("span");
    const error = document.createElement("p");
    const formattedDate = formatCandidateDate(fromIsoDate(candidate.date));
    const errorId = `candidate-error-${candidate.date}`;

    card.className = "candidate-card";
    card.dataset.candidateDate = candidate.date;
    header.className = "candidate-card-header";
    headingGroup.className = "candidate-heading-group";
    candidateIndex.className = "candidate-index";
    candidateIndex.textContent = `候補 ${index + 1}`;
    dateHeading.className = "candidate-date";
    dateHeading.textContent = formattedDate;

    removeButton.className = "candidate-remove-button";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `${formattedDate}を候補から削除`);
    removeButton.innerHTML =
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" /></svg>';
    removeButton.addEventListener("click", function handleCandidateRemoval() {
      removeCandidate(candidate.date, index);
    });

    headingGroup.append(candidateIndex, dateHeading);
    header.append(headingGroup, removeButton);

    timeRange.className = "time-range";
    separator.className = "time-separator";
    separator.textContent = "〜";
    separator.setAttribute("aria-hidden", "true");
    timeRange.append(
      createTimeSelect(candidate, "startTime", "開始", errorId),
      separator,
      createTimeSelect(candidate, "endTime", "終了", errorId),
    );

    error.id = errorId;
    error.className = "candidate-time-error";
    error.setAttribute("aria-live", "polite");
    card.append(header, timeRange, error);
    return card;
  }

  function renderCandidates() {
    const sortedCandidates = getSortedCandidates();
    const fragment = document.createDocumentFragment();
    const count = sortedCandidates.length;

    candidateList.replaceChildren();
    candidateEmpty.hidden = count > 0;
    candidateCount.textContent = `${count}件`;
    selectedCountLabel.textContent = `${count} / ${MAX_CANDIDATES}件`;
    selectionPanel.classList.toggle("has-selection", count > 0);

    sortedCandidates.forEach((candidate, index) => {
      fragment.append(createCandidateCard(candidate, index));
    });

    candidateList.append(fragment);
    syncScheduleData();
  }

  function timeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function isCandidateTimeValid(candidate) {
    return timeToMinutes(candidate.startTime) < timeToMinutes(candidate.endTime);
  }

  function validateCandidate(isoDate) {
    const candidate = candidates.get(isoDate);
    const card = candidateList.querySelector(`[data-candidate-date="${isoDate}"]`);

    if (!candidate || !card) {
      return true;
    }

    const isValid = isCandidateTimeValid(candidate);
    const error = card.querySelector(".candidate-time-error");

    card.querySelectorAll(".time-select").forEach((select) => {
      select.setAttribute("aria-invalid", String(!isValid));
    });
    error.textContent = isValid ? "" : "終了時刻は開始時刻より後にしてください。";
    return isValid;
  }

  function validateCandidates() {
    return getSortedCandidates().every((candidate) =>
      validateCandidate(candidate.date),
    );
  }

  function syncScheduleData() {
    scheduleDataInput.value = JSON.stringify(getCandidates());
  }

  function dispatchScheduleChange() {
    document.dispatchEvent(
      new CustomEvent("teamsync:schedulechange", {
        detail: { candidates: getCandidates() },
      }),
    );
  }

  function toggleDate(date) {
    const isoDate = toIsoDate(startOfDay(date));

    if (candidates.has(isoDate)) {
      candidates.delete(isoDate);
    } else {
      if (candidates.size >= MAX_CANDIDATES) {
        scheduleError.textContent = `候補日時は${MAX_CANDIDATES}件まで選択できます。`;
        return;
      }

      candidates.set(isoDate, {
        date: isoDate,
        startTime: DEFAULT_START_TIME,
        endTime: DEFAULT_END_TIME,
      });
    }

    scheduleError.textContent = "";
    renderCalendar();
    renderCandidates();
    dispatchScheduleChange();
  }

  function removeCandidate(isoDate, previousIndex) {
    candidates.delete(isoDate);
    scheduleError.textContent = "";
    renderCalendar();
    renderCandidates();
    dispatchScheduleChange();

    const remainingRemoveButtons = candidateList.querySelectorAll(
      ".candidate-remove-button",
    );
    const nextButtonToFocus =
      remainingRemoveButtons[Math.min(previousIndex, remainingRemoveButtons.length - 1)];
    const visibleDayButton = grid.querySelector(`[data-date="${isoDate}"]`);
    (nextButtonToFocus || visibleDayButton || grid.querySelector(".calendar-day:not(:disabled)"))?.focus();
  }

  function clearSelection() {
    candidates.clear();
    scheduleError.textContent = "";
    renderCalendar();
    renderCandidates();
    dispatchScheduleChange();
  }

  function changeMonth(offset) {
    visibleMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1,
    );
    renderCalendar();
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
    const focusedDate = fromIsoDate(event.currentTarget.dataset.date);
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
      renderCalendar();
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

  renderCalendar();
  renderCandidates();

  window.TeamSyncCalendar = Object.freeze({
    isAvailable: true,
    maxCandidates: MAX_CANDIDATES,
    getCandidates,
    getSelectedDate: function getSelectedDate() {
      return getCandidates()[0]?.date || null;
    },
    validateCandidates,
    clearSelection,
  });
})();
