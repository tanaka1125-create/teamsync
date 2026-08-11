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
  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  document.documentElement.dataset.teamsyncPhase = String(
    window.TeamSyncConfig?.phase ?? 5,
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

  function renderEvent(eventData) {
    const url = getCanonicalEventUrl(eventData.id);

    title.textContent = eventData.title;
    description.textContent = eventData.description || "説明はありません。";
    description.classList.toggle("is-empty", !eventData.description);
    candidateCount.textContent = `${eventData.dates.length}件`;
    shareUrl.textContent = url;
    shareUrl.title = url;
    dateList.replaceChildren();

    eventData.dates.forEach((candidate, index) => {
      const item = document.createElement("li");
      item.className = "event-date-item";

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
      item.append(indexLabel, detail);
      dateList.append(item);
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

  copyButton.addEventListener("click", copyEventUrl);
  loadEvent();
})();
