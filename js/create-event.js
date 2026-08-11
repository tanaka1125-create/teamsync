(function initializeCreateEventForm() {
  "use strict";

  const form = document.querySelector("#create-event-form");

  if (!form) {
    return;
  }

  const titleInput = form.querySelector("#event-title");
  const descriptionInput = form.querySelector("#event-description");
  const titleError = form.querySelector("#event-title-error");
  const titleCount = form.querySelector("#event-title-count");
  const descriptionCount = form.querySelector("#event-description-count");
  const phaseNotice = form.querySelector("#phase-notice");
  const scheduleError = form.querySelector("#schedule-error");

  function updateCount(input, output) {
    output.textContent = `${input.value.length} / ${input.maxLength}`;
  }

  function validateTitle() {
    const isValid = titleInput.value.trim().length > 0;
    titleInput.setAttribute("aria-invalid", String(!isValid));
    titleError.textContent = isValid ? "" : "イベント名を入力してください。";
    return isValid;
  }

  function validateSchedule() {
    const isValid = Boolean(window.TeamSyncCalendar?.getSelectedDate?.());
    scheduleError.textContent = isValid ? "" : "候補日を1日選択してください。";
    return isValid;
  }

  titleInput.addEventListener("input", function handleTitleInput() {
    updateCount(titleInput, titleCount);

    if (titleInput.getAttribute("aria-invalid") === "true") {
      validateTitle();
    }
  });

  descriptionInput.addEventListener("input", function handleDescriptionInput() {
    updateCount(descriptionInput, descriptionCount);
  });

  document.addEventListener("teamsync:datechange", function handleDateChange() {
    scheduleError.textContent = "";
  });

  form.addEventListener("submit", function handleSubmit(event) {
    event.preventDefault();

    const isTitleValid = validateTitle();
    const isScheduleValid = validateSchedule();

    if (!isTitleValid) {
      phaseNotice.hidden = true;
      titleInput.focus();
      return;
    }

    if (!isScheduleValid) {
      phaseNotice.hidden = true;
      form.querySelector(".calendar-day:not(:disabled)")?.focus();
      return;
    }

    phaseNotice.textContent =
      "イベント名と候補日を確認しました。複数候補と時刻選択は次のフェーズで有効になります。";
    phaseNotice.hidden = false;
  });
})();
