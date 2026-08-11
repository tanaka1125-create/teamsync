(function initializeEventPage() {
  "use strict";

  const loadingState = document.querySelector("#event-loading");
  const errorState = document.querySelector("#event-error");
  const errorMessage = document.querySelector("#event-error-message");
  const content = document.querySelector("#event-content");
  const title = document.querySelector("#event-title");
  const description = document.querySelector("#event-description");
  const candidateCount = document.querySelector("#event-candidate-count");
  const dateList = document.querySelector("#event-date-list");
  const shareUrl = document.querySelector("#share-url");
  const copyButton = document.querySelector("#copy-url-button");
  const copyLabel = document.querySelector("#copy-url-label");
  const copyStatus = document.querySelector("#copy-status");
  const responseForm = document.querySelector("#response-form");
  const participantName = document.querySelector("#participant-name");
  const participantNameCount = document.querySelector("#participant-name-count");
  const participantNameError = document.querySelector("#participant-name-error");
  const responseFormError = document.querySelector("#response-form-error");
  const submitResponseButton = document.querySelector("#submit-response-button");
  const submitResponseLabel = document.querySelector("#submit-response-button-label");
  const submitResponseSpinner = submitResponseButton.querySelector(".button-spinner");
  const responseNotice = document.querySelector("#response-notice");
  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const STATUS_OPTIONS = [
    { value: "yes", symbol: "○", label: "参加" },
    { value: "maybe", symbol: "△", label: "未定" },
    { value: "no", symbol: "×", label: "不参加" },
  ];
  let currentEventId = "";

  document.documentElement.dataset.teamsyncPhase = String(
    window.TeamSyncConfig?.phase ?? 6,
  );

  function getCanonicalEventUrl(eventId) {
    const url = new URL("event.html", window.location.href);
    url.search = "";
    url.searchParams.set("id", eventId);
    return url.href;
  }

  function formatEventDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(date);
  }

  function showError(message) {
    loadingState.hidden = true;
    content.hidden = true;
    errorMessage.textContent = message;
    errorState.hidden = false;
  }

  function hideResponseNotice() {
    responseNotice.hidden = true;
    responseNotice.classList.remove("is-success", "is-error");
  }

  function showResponseNotice(message, type) {
    responseNotice.textContent = message;
    responseNotice.classList.toggle("is-success", type === "success");
    responseNotice.classList.toggle("is-error", type === "error");
    responseNotice.hidden = false;
  }

  function createStatusOption(candidateId, option) {
    const inputId = `status-${candidateId}-${option.value}`;
    const input = document.createElement("input");
    input.className = "response-status-input";
    input.type = "radio";
    input.name = `status-${candidateId}`;
    input.id = inputId;
    input.value = option.value;

    const label = document.createElement("label");
    label.className = `response-status-option is-${option.value}`;
    label.htmlFor = inputId;

    const symbol = document.createElement("strong");
    symbol.textContent = option.symbol;

    const text = document.createElement("span");
    text.textContent = option.label;

    label.append(symbol, text);
    return { input, label };
  }

  function createResponseCandidate(candidate, index) {
    const item = document.createElement("li");
    item.className = "event-date-item response-date-card";
    item.dataset.eventDateId = candidate.id;

    const main = document.createElement("div");
    main.className = "event-date-main";

    const indexLabel = document.createElement("span");
    indexLabel.className = "event-date-index";
    indexLabel.textContent = String(index + 1).padStart(2, "0");

    const detail = document.createElement("div");
    detail.className = "event-date-detail";

    const dateLabel = document.createElement("strong");
    dateLabel.textContent = formatEventDate(candidate.eventDate);

    const timeLabel = document.createElement("span");
    timeLabel.textContent = `${candidate.startTime} 〜 ${candidate.endTime}`;

    detail.append(dateLabel, timeLabel);
    main.append(indexLabel, detail);

    const fields = document.createElement("div");
    fields.className = "response-date-fields";

    const statusFieldset = document.createElement("fieldset");
    statusFieldset.className = "response-status-fieldset";

    const statusLegend = document.createElement("legend");
    statusLegend.textContent = "出欠";

    const statusOptions = document.createElement("div");
    statusOptions.className = "response-status-options";

    const commentId = `comment-${candidate.id}`;
    const comment = document.createElement("textarea");
    comment.className = "response-comment";
    comment.id = commentId;
    comment.rows = 2;
    comment.maxLength = 200;
    comment.placeholder = "補足があれば入力してください";
    comment.disabled = true;

    STATUS_OPTIONS.forEach((option) => {
      const choice = createStatusOption(candidate.id, option);
      choice.input.addEventListener("change", () => {
        comment.disabled = false;
        item.dataset.responseStatus = option.value;
        responseFormError.textContent = "";
        hideResponseNotice();
      });
      statusOptions.append(choice.input, choice.label);
    });

    statusFieldset.append(statusLegend, statusOptions);

    const commentGroup = document.createElement("div");
    commentGroup.className = "response-comment-group";

    const commentHeading = document.createElement("div");
    commentHeading.className = "response-comment-heading";

    const commentLabel = document.createElement("label");
    commentLabel.htmlFor = commentId;
    commentLabel.textContent = "コメント（任意）";

    const commentCount = document.createElement("span");
    commentCount.className = "character-count";
    commentCount.textContent = "0 / 200";
    commentCount.setAttribute("aria-hidden", "true");

    comment.addEventListener("input", () => {
      commentCount.textContent = `${comment.value.length} / 200`;
      hideResponseNotice();
    });

    commentHeading.append(commentLabel, commentCount);
    commentGroup.append(commentHeading, comment);
    fields.append(statusFieldset, commentGroup);
    item.append(main, fields);
    return item;
  }

  function renderEvent(eventData) {
    const url = getCanonicalEventUrl(eventData.id);
    currentEventId = eventData.id;

    title.textContent = eventData.title;
    description.textContent = eventData.description || "説明はありません。";
    description.classList.toggle("is-empty", !eventData.description);
    candidateCount.textContent = `${eventData.dates.length}件`;
    shareUrl.textContent = url;
    shareUrl.title = url;
    dateList.replaceChildren();

    eventData.dates.forEach((candidate, index) => {
      dateList.append(createResponseCandidate(candidate, index));
    });

    document.title = `${eventData.title} | TeamSync`;
    loadingState.hidden = true;
    errorState.hidden = true;
    content.hidden = false;
  }

  async function copyEventUrl() {
    const url = shareUrl.textContent;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const temporaryInput = document.createElement("textarea");
        temporaryInput.value = url;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.append(temporaryInput);
        temporaryInput.select();

        if (!document.execCommand("copy")) {
          throw new Error("copy failed");
        }

        temporaryInput.remove();
      }

      copyLabel.textContent = "コピーしました";
      copyStatus.textContent = "イベント専用URLをコピーしました。";
      window.setTimeout(() => {
        copyLabel.textContent = "URLをコピー";
      }, 2200);
    } catch {
      copyStatus.textContent = "コピーできませんでした。URLを選択してコピーしてください。";
    }
  }

  function getSelectedResponses() {
    return Array.from(dateList.querySelectorAll("[data-event-date-id]"))
      .map((item) => {
        const selectedStatus = item.querySelector('input[type="radio"]:checked');

        if (!selectedStatus) {
          return null;
        }

        return {
          eventDateId: item.dataset.eventDateId,
          status: selectedStatus.value,
          comment: item.querySelector(".response-comment").value,
        };
      })
      .filter(Boolean);
  }

  function validateParticipantName() {
    const isValid = participantName.value.trim().length > 0;
    participantName.setAttribute("aria-invalid", String(!isValid));
    participantNameError.textContent = isValid ? "" : "名前を入力してください。";
    return isValid;
  }

  function setResponseSubmitting(isSubmitting) {
    submitResponseButton.disabled = isSubmitting;
    submitResponseButton.setAttribute("aria-busy", String(isSubmitting));
    submitResponseLabel.textContent = isSubmitting ? "保存しています…" : "回答を保存";
    submitResponseSpinner.hidden = !isSubmitting;
  }

  function getResponseErrorMessage(error) {
    switch (error?.code) {
      case "NOT_CONFIGURED":
        return "回答の保存設定が完了していません。";
      case "TIMEOUT":
        return "保存処理がタイムアウトしました。通信環境を確認してください。";
      case "NETWORK_ERROR":
        return "回答を保存できませんでした。通信環境を確認してください。";
      case "INVALID_RESPONSE":
        return "回答の保存結果を確認できませんでした。もう一度お試しください。";
      default:
        return "回答を保存できませんでした。入力内容を確認してもう一度お試しください。";
    }
  }

  async function loadEvent() {
    const eventId = new URLSearchParams(window.location.search).get("id")?.trim();

    if (!eventId || !UUID_PATTERN.test(eventId)) {
      showError("URLが正しくありません。共有されたイベント専用URLを確認してください。");
      return;
    }

    if (!window.TeamSyncApi?.isConfigured?.()) {
      showError("イベントの読み込み設定が完了していません。");
      return;
    }

    try {
      const eventData = await window.TeamSyncApi.getEvent(eventId);

      if (!eventData) {
        showError("イベントが見つかりませんでした。URLが正しいか確認してください。");
        return;
      }

      renderEvent(eventData);
    } catch {
      showError("イベントを読み込めませんでした。時間をおいてもう一度お試しください。");
    }
  }

  participantName.addEventListener("input", () => {
    participantNameCount.textContent = `${participantName.value.length} / 40`;

    if (participantName.getAttribute("aria-invalid") === "true") {
      validateParticipantName();
    }

    hideResponseNotice();
  });

  responseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const isNameValid = validateParticipantName();
    const responses = getSelectedResponses();

    if (!isNameValid) {
      hideResponseNotice();
      participantName.focus();
      return;
    }

    if (responses.length === 0) {
      hideResponseNotice();
      responseFormError.textContent = "○・△・×を1件以上選択してください。";
      dateList.querySelector(".response-status-input")?.focus();
      return;
    }

    responseFormError.textContent = "";
    hideResponseNotice();
    setResponseSubmitting(true);

    try {
      const result = await window.TeamSyncApi.submitResponses({
        eventId: currentEventId,
        name: participantName.value,
        responses,
      });
      const savedName = participantName.value.trim();
      showResponseNotice(
        `${savedName}さんの回答を${result.savedCount}件保存しました。同じ名前で再回答すると、選択した候補を更新できます。`,
        "success",
      );
    } catch (error) {
      showResponseNotice(getResponseErrorMessage(error), "error");
    } finally {
      setResponseSubmitting(false);
    }
  });

  copyButton.addEventListener("click", copyEventUrl);
  loadEvent();
})();
