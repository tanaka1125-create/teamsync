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
  const scheduleError = form.querySelector("#schedule-error");
  const phaseNotice = form.querySelector("#phase-notice");
  const submitButton = form.querySelector("#create-event-button");
  const submitButtonLabel = form.querySelector("#create-event-button-label");
  const buttonSpinner = submitButton.querySelector(".button-spinner");
  const supabaseStatus = form.querySelector("#supabase-status");
  const supabaseStatusLabel = form.querySelector("#supabase-status-label");
  const supabaseStatusDetail = form.querySelector("#supabase-status-detail");

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

  function renderSupabaseStatus() {
    const isConfigured = window.TeamSyncApi?.isConfigured?.() ?? false;

    supabaseStatus.classList.toggle("is-ready", isConfigured);
    supabaseStatus.classList.toggle("is-missing", !isConfigured);
    supabaseStatusLabel.textContent = isConfigured
      ? "Supabaseへの保存準備ができています"
      : "Supabaseの接続設定が必要です";
    supabaseStatusDetail.textContent = isConfigured
      ? "イベント作成時に候補日時と一緒に保存されます。"
      : "js/config.jsにProject URLとpublishable/anon keyを設定してください。";
  }

  function showNotice(message, type) {
    phaseNotice.textContent = message;
    phaseNotice.hidden = false;
    phaseNotice.classList.toggle("is-success", type === "success");
    phaseNotice.classList.toggle("is-error", type === "error");
  }

  function hideNotice() {
    phaseNotice.hidden = true;
    phaseNotice.classList.remove("is-success", "is-error");
  }

  function setSubmitting(isSubmitting) {
    submitButton.disabled = isSubmitting;
    submitButton.setAttribute("aria-busy", String(isSubmitting));
    submitButtonLabel.textContent = isSubmitting ? "保存しています…" : "イベントを作成";
    buttonSpinner.hidden = !isSubmitting;
  }

  function getSaveErrorMessage(error) {
    switch (error?.code) {
      case "NOT_CONFIGURED":
        return "Supabaseの接続情報が未設定です。設定後にもう一度お試しください。";
      case "TIMEOUT":
        return "保存処理がタイムアウトしました。通信環境を確認して再度お試しください。";
      case "NETWORK_ERROR":
        return "Supabaseに接続できませんでした。通信環境とProject URLを確認してください。";
      case "INVALID_RESPONSE":
        return "イベントIDを取得できませんでした。SupabaseのSQL設定を確認してください。";
      default:
        return "イベントを保存できませんでした。Supabaseの設定とSQLを確認してください。";
    }
  }

  titleInput.addEventListener("input", function handleTitleInput() {
    updateCount(titleInput, titleCount);

    if (titleInput.getAttribute("aria-invalid") === "true") {
      validateTitle();
    }

    hideNotice();
  });

  descriptionInput.addEventListener("input", function handleDescriptionInput() {
    updateCount(descriptionInput, descriptionCount);
    hideNotice();
  });

  document.addEventListener(
    "teamsync:schedulechange",
    function handleScheduleChange(event) {
      if (event.detail.candidates.length > 0) {
        scheduleError.textContent = "";
      }
      hideNotice();
    },
  );

  form.addEventListener("submit", async function handleSubmit(event) {
    event.preventDefault();

    const isTitleValid = validateTitle();
    const isScheduleValid = validateSchedule();

    if (!isTitleValid) {
      hideNotice();
      titleInput.focus();
      return;
    }

    if (!isScheduleValid) {
      hideNotice();
      (
        form.querySelector('.time-select[aria-invalid="true"]') ||
        form.querySelector(".calendar-day:not(:disabled)")
      )?.focus();
      return;
    }

    if (!window.TeamSyncApi?.isConfigured?.()) {
      showNotice(
        "Supabaseの接続情報が未設定です。設定後にもう一度お試しください。",
        "error",
      );
      supabaseStatus.focus();
      return;
    }

    setSubmitting(true);
    hideNotice();

    try {
      const eventId = await window.TeamSyncApi.createEvent({
        title: titleInput.value,
        description: descriptionInput.value,
        candidates: window.TeamSyncCalendar.getCandidates(),
      });

      form.dataset.eventId = eventId;
      showNotice("イベントを保存しました。専用ページへ移動します…", "success");
      const eventUrl = new URL("event.html", window.location.href);
      eventUrl.searchParams.set("id", eventId);
      window.location.assign(eventUrl.href);
    } catch (error) {
      showNotice(getSaveErrorMessage(error), "error");
    } finally {
      setSubmitting(false);
    }
  });

  renderSupabaseStatus();
})();
