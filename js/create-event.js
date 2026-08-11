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
    const candidates = window.TeamSyncCalendar?.getCandidates?.() ?? [];

    if (candidates.length === 0) {
      scheduleError.textContent = "候補日時を1件以上選択してください。";
      return false;
    }

    const areTimesValid = window.TeamSyncCalendar?.validateCandidates?.() ?? false;
    scheduleError.textContent = areTimesValid
      ? ""
      : "開始・終了時刻を確認してください。";
    return areTimesValid;
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

  document.addEventListener(
    "teamsync:schedulechange",
    function handleScheduleChange(event) {
      if (event.detail.candidates.length > 0) {
        scheduleError.textContent = "";
      }
      phaseNotice.hidden = true;
    },
  );

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
      (
        form.querySelector('.time-select[aria-invalid="true"]') ||
        form.querySelector(".calendar-day:not(:disabled)")
      )?.focus();
      return;
    }

    phaseNotice.textContent =
      "イベント名と候補日時を確認しました。保存機能はSupabase接続後のフェーズで有効になります。";
    phaseNotice.hidden = false;
  });
})();
