(function initializeEventPages() {
  "use strict";

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const STATUS_OPTIONS = [
    { value: "yes", symbol: "○", label: "参加" },
    { value: "maybe", symbol: "△", label: "未定" },
    { value: "no", symbol: "×", label: "不参加" },
  ];
  const query = new URLSearchParams(window.location.search);
  const eventId = query.get("id")?.trim() || "";
  const participantIdFromUrl = query.get("participant")?.trim() || "";
  const responseForm = document.querySelector("#response-form");
  const isResponsePage = Boolean(responseForm);

  let currentEvent = null;
  let currentResults = null;
  let currentParticipantId = "";
  let currentParticipantToken = "";
  let adminToken = "";
  let isAdmin = false;
  let isLoadingResults = false;

  const el = (selector) => document.querySelector(selector);

  function canonicalEventUrl(id = eventId) {
    const url = new URL("event.html", window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("id", id);
    return url.href;
  }

  function responseUrl(id = eventId, participantId = "") {
    const url = new URL("response.html", window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("id", id);
    if (participantId) url.searchParams.set("participant", participantId);
    return url.href;
  }

  function manageUrl() {
    const url = new URL("manage.html", window.location.href);
    url.search = "";
    url.searchParams.set("id", eventId);
    url.hash = new URLSearchParams({ admin: adminToken }).toString();
    return url.href;
  }

  function formatDate(dateString, compact = false) {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("ja-JP", compact
      ? { month: "numeric", day: "numeric", weekday: "short" }
      : { year: "numeric", month: "long", day: "numeric", weekday: "short" }
    ).format(date);
  }

  function formatDeadline(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(date);
  }

  function deadlinePassed() {
    return Boolean(currentEvent?.responseDeadline && Date.now() > new Date(currentEvent.responseDeadline).getTime());
  }

  function showPageError(message) {
    el("#event-loading").hidden = true;
    el("#event-content").hidden = true;
    el("#event-error-message").textContent = message;
    el("#event-error").hidden = false;
  }

  function renderCommonEvent() {
    el("#event-title").textContent = currentEvent.title;
    el("#event-description").textContent = currentEvent.description || "メモはありません。";
    el("#event-description").classList.toggle("is-empty", !currentEvent.description);
    el("#event-candidate-count")?.replaceChildren(document.createTextNode(`${currentEvent.dates.length}件`));
    el("#back-to-results-link")?.setAttribute("href", canonicalEventUrl());
    document.title = isResponsePage
      ? `${currentEvent.title}の出欠を入力 | TeamSync`
      : `${currentEvent.title} | TeamSync`;

    const deadlineText = currentEvent.responseDeadline
      ? `回答締切：${formatDeadline(currentEvent.responseDeadline)}${deadlinePassed() ? "（締切済み）" : ""}`
      : "回答締切は設定されていません";
    const deadlineStatus = el("#deadline-status");
    if (deadlineStatus) {
      deadlineStatus.textContent = deadlineText;
      deadlineStatus.classList.toggle("is-closed", deadlinePassed());
    }

    if (currentEvent.confirmedEventDateId) {
      const confirmed = currentEvent.dates.find((date) => date.id === currentEvent.confirmedEventDateId);
      if (confirmed && el("#confirmed-banner")) {
        el("#confirmed-date").textContent = `${formatDate(confirmed.eventDate)} ${confirmed.startTime}〜${confirmed.endTime}`;
        el("#confirmed-banner").hidden = false;
      }
    }

    el("#event-loading").hidden = true;
    el("#event-error").hidden = true;
    el("#event-content").hidden = false;
  }

  function renderEventPage() {
    const share = canonicalEventUrl();
    el("#share-url").textContent = share;
    el("#share-url").title = share;
    el("#response-page-link").href = responseUrl();
    if (deadlinePassed()) {
      el("#response-page-link").classList.add("is-disabled");
      el("#response-page-link").setAttribute("aria-disabled", "true");
      el("#response-page-link").textContent = "回答受付は終了しました";
    }
    if (isAdmin) {
      el("#manage-event-link").href = manageUrl();
      el("#manage-event-link").hidden = false;
    }
  }

  function createStatusChoice(candidateId, option) {
    const id = `status-${candidateId}-${option.value}`;
    const input = document.createElement("input");
    input.type = "radio";
    input.className = "response-status-input";
    input.name = `status-${candidateId}`;
    input.id = id;
    input.value = option.value;
    const label = document.createElement("label");
    label.className = `response-status-option is-${option.value}`;
    label.htmlFor = id;
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

    const heading = document.createElement("div");
    heading.className = "event-date-main";
    const number = document.createElement("span");
    number.className = "event-date-index";
    number.textContent = String(index + 1).padStart(2, "0");
    const detail = document.createElement("div");
    detail.className = "event-date-detail";
    const date = document.createElement("strong");
    date.textContent = formatDate(candidate.eventDate);
    const time = document.createElement("span");
    time.textContent = `${candidate.startTime}〜${candidate.endTime}`;
    detail.append(date, time);
    heading.append(number, detail);

    const fieldset = document.createElement("fieldset");
    fieldset.className = "response-status-fieldset";
    const legend = document.createElement("legend");
    legend.textContent = "出欠";
    const choices = document.createElement("div");
    choices.className = "response-status-options";
    const comment = document.createElement("textarea");
    comment.className = "response-comment";
    comment.rows = 2;
    comment.maxLength = 200;
    comment.placeholder = "コメント（任意）";
    comment.disabled = true;

    STATUS_OPTIONS.forEach((option) => {
      const choice = createStatusChoice(candidate.id, option);
      choice.input.addEventListener("change", () => {
        comment.disabled = false;
        item.dataset.responseStatus = option.value;
        el("#response-form-error").textContent = "";
      });
      choices.append(choice.input, choice.label);
    });
    fieldset.append(legend, choices);
    item.append(heading, fieldset, comment);
    return item;
  }

  function renderResponsePage() {
    const list = el("#event-date-list");
    list.replaceChildren(...currentEvent.dates.map(createResponseCandidate));
    if (currentEvent.responsesProtected) {
      el("#response-mode-hint").textContent = "回答したブラウザからのみ変更できます";
    }
    if (deadlinePassed()) {
      el("#response-closed").hidden = false;
      responseForm.hidden = true;
    }
  }

  function participantCanEdit(participant) {
    return !currentEvent.responsesProtected ||
      Boolean(window.TeamSyncSecrets.getParticipantToken(eventId, participant.id));
  }

  function createParticipantHeading(participant, index) {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = "participant-heading";
    const wrap = document.createElement("div");
    wrap.className = "participant-heading-inner";
    if (participantCanEdit(participant)) {
      const link = document.createElement("a");
      link.href = responseUrl(eventId, participant.id);
      link.textContent = participant.name;
      link.className = "participant-edit-link";
      link.title = "回答を変更";
      wrap.append(link);
    } else {
      const name = document.createElement("span");
      name.textContent = participant.name;
      wrap.append(name);
    }

    if (isAdmin) {
      const actions = document.createElement("span");
      actions.className = "participant-admin-actions";
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "←";
      up.title = "左へ移動";
      up.disabled = index === 0;
      up.addEventListener("click", () => moveParticipant(index, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "→";
      down.title = "右へ移動";
      down.disabled = index === currentResults.participants.length - 1;
      down.addEventListener("click", () => moveParticipant(index, 1));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "削除";
      remove.title = `${participant.name}さんの回答を削除`;
      remove.addEventListener("click", () => deleteParticipant(participant, remove));
      actions.append(up, down, remove);
      wrap.append(actions);
    }
    th.append(wrap);
    return th;
  }

  function statusCell(response) {
    const cell = document.createElement("td");
    const option = STATUS_OPTIONS.find((item) => item.value === response?.status);
    const mark = document.createElement("strong");
    mark.className = `attendance-mark is-${option?.value || "none"}`;
    mark.textContent = option?.symbol || "−";
    cell.append(mark);
    if (response?.comment) {
      const comment = document.createElement("small");
      comment.textContent = response.comment;
      comment.title = response.comment;
      cell.append(comment);
    }
    return cell;
  }

  function renderAttendanceTable(results) {
    const counts = new Map(results.counts.map((item) => [item.eventDateId, item]));
    const scores = results.counts.map((item) => Number(item.score ?? (item.yesCount + item.maybeCount * 0.5)));
    const maxScore = results.participantCount > 0 ? Math.max(...scores, 0) : -1;
    const header = document.createElement("tr");
    const schedule = document.createElement("th");
    schedule.scope = "col";
    schedule.textContent = "候補日時";
    const aggregate = document.createElement("th");
    aggregate.scope = "col";
    aggregate.textContent = "集計";
    header.append(schedule, aggregate);
    results.participants.forEach((participant, index) => {
      header.append(createParticipantHeading(participant, index));
    });
    el("#results-table-head").replaceChildren(header);

    const rows = currentEvent.dates.map((candidate) => {
      const count = counts.get(candidate.id) ?? {
        yesCount: 0, maybeCount: 0, noCount: 0, unansweredCount: results.participantCount, score: 0,
      };
      const score = Number(count.score ?? (count.yesCount + count.maybeCount * 0.5));
      const row = document.createElement("tr");
      if (score === maxScore && maxScore > 0) row.classList.add("is-best-candidate");
      if (candidate.id === currentEvent.confirmedEventDateId) row.classList.add("is-confirmed-candidate");

      const heading = document.createElement("th");
      heading.scope = "row";
      const date = document.createElement("strong");
      date.textContent = formatDate(candidate.eventDate, true);
      const time = document.createElement("span");
      time.textContent = `${candidate.startTime}〜${candidate.endTime}`;
      heading.append(date, time);
      if (row.classList.contains("is-best-candidate")) {
        const best = document.createElement("em");
        best.textContent = "おすすめ";
        heading.append(best);
      }

      const total = document.createElement("td");
      total.className = "attendance-count-cell";
      total.innerHTML = `<span class="is-yes">○ ${count.yesCount}</span><span class="is-maybe">△ ${count.maybeCount}</span><span class="is-no">× ${count.noCount}</span>`;
      row.append(heading, total);

      results.participants.forEach((participant) => {
        const response = participant.responses?.find((item) => item.eventDateId === candidate.id);
        row.append(statusCell(response));
      });
      return row;
    });
    el("#results-table-body").replaceChildren(...rows);
    el("#results-table-foot").replaceChildren();
  }

  function renderResults(results) {
    currentResults = results;
    el("#results-participant-count").textContent = `${results.participantCount}人が回答`;
    el("#results-loading").hidden = true;
    el("#results-error").hidden = true;
    if (results.participantCount === 0) {
      el("#results-content").hidden = true;
      el("#results-empty").hidden = false;
      return;
    }
    renderAttendanceTable(results);
    el("#results-empty").hidden = true;
    el("#results-content").hidden = false;
  }

  async function loadResults() {
    if (!el("#results-content") || isLoadingResults) return;
    isLoadingResults = true;
    el("#refresh-results-button").disabled = true;
    el("#results-loading").hidden = false;
    try {
      const results = await window.TeamSyncApi.getEventResults(eventId);
      if (!results) throw new Error("not found");
      renderResults(results);
    } catch {
      el("#results-loading").hidden = true;
      el("#results-content").hidden = true;
      el("#results-empty").hidden = true;
      el("#results-error").hidden = false;
    } finally {
      isLoadingResults = false;
      el("#refresh-results-button").disabled = false;
    }
  }

  function showActionNotice(message, type) {
    const notice = el("#results-action-notice");
    if (!notice) return;
    notice.textContent = message;
    notice.className = `phase-notice is-${type}`;
    notice.hidden = false;
  }

  async function moveParticipant(index, offset) {
    const participants = [...currentResults.participants];
    const nextIndex = index + offset;
    [participants[index], participants[nextIndex]] = [participants[nextIndex], participants[index]];
    try {
      await window.TeamSyncApi.reorderParticipants(
        eventId, adminToken, participants.map((participant) => participant.id),
      );
      await loadResults();
    } catch {
      showActionNotice("参加者の並び順を変更できませんでした。", "error");
    }
  }

  async function deleteParticipant(participant, button) {
    if (button.dataset.confirm !== "true") {
      button.dataset.confirm = "true";
      button.textContent = "確認";
      showActionNotice(`${participant.name}さんを削除する場合は、もう一度「確認」を押してください。`, "warning");
      window.setTimeout(() => {
        if (button.isConnected) {
          button.dataset.confirm = "false";
          button.textContent = "削除";
        }
      }, 6000);
      return;
    }
    button.disabled = true;
    try {
      await window.TeamSyncApi.adminDeleteParticipant(eventId, adminToken, participant.id);
      showActionNotice(`${participant.name}さんの回答を削除しました。`, "success");
      await loadResults();
    } catch {
      showActionNotice("回答を削除できませんでした。", "error");
      button.disabled = false;
    }
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function downloadCsv() {
    if (!currentResults) return;
    const header = ["候補日時", "○", "△", "×", ...currentResults.participants.map((p) => p.name)];
    const lines = [header.map(csvEscape).join(",")];
    currentEvent.dates.forEach((candidate) => {
      const count = currentResults.counts.find((item) => item.eventDateId === candidate.id) || {};
      const row = [
        `${formatDate(candidate.eventDate)} ${candidate.startTime}〜${candidate.endTime}`,
        count.yesCount || 0,
        count.maybeCount || 0,
        count.noCount || 0,
      ];
      currentResults.participants.forEach((participant) => {
        const response = participant.responses?.find((item) => item.eventDateId === candidate.id);
        const option = STATUS_OPTIONS.find((item) => item.value === response?.status);
        row.push(response ? `${option?.symbol || ""}${response.comment ? ` ${response.comment}` : ""}` : "");
      });
      lines.push(row.map(csvEscape).join(","));
    });
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${currentEvent.title.replace(/[\\/:*?"<>|]/g, "_")}-出欠表.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function copyShareUrl() {
    const value = canonicalEventUrl();
    try {
      await navigator.clipboard.writeText(value);
      el("#copy-url-label").textContent = "コピーしました";
      el("#copy-status").textContent = "参加者用URLをコピーしました。幹事用URLは含まれていません。";
      window.setTimeout(() => { el("#copy-url-label").textContent = "URLをコピー"; }, 2000);
    } catch {
      el("#copy-status").textContent = "URLを選択してコピーしてください。";
    }
  }

  function selectedResponses() {
    return Array.from(el("#event-date-list").querySelectorAll("[data-event-date-id]"))
      .map((item) => {
        const checked = item.querySelector('input[type="radio"]:checked');
        if (!checked) return null;
        return {
          eventDateId: item.dataset.eventDateId,
          status: checked.value,
          comment: item.querySelector(".response-comment").value,
        };
      }).filter(Boolean);
  }

  function populateParticipant(participant) {
    currentParticipantId = participant.id;
    currentParticipantToken = window.TeamSyncSecrets.getParticipantToken(eventId, participant.id);
    if (currentEvent.responsesProtected && !currentParticipantToken) {
      showPageError("この回答は保護されています。回答を登録したブラウザから開いてください。");
      return false;
    }
    el("#participant-name").value = participant.name;
    el("#participant-name-count").textContent = `${participant.name.length} / 40`;
    el("#event-dates-title").textContent = "回答内容を変更";
    el("#submit-response-button-label").textContent = "変更を保存";
    const responseMap = new Map(participant.responses.map((item) => [item.eventDateId, item]));
    el("#event-date-list").querySelectorAll("[data-event-date-id]").forEach((item) => {
      const response = responseMap.get(item.dataset.eventDateId);
      if (!response) return;
      const input = item.querySelector(`input[value="${response.status}"]`);
      const comment = item.querySelector(".response-comment");
      if (input) input.checked = true;
      comment.disabled = false;
      comment.value = response.comment || "";
    });
    return true;
  }

  function responseError(error) {
    const messages = {
      PARTICIPANT_NAME_EXISTS: "この名前はすでに使われています。",
      RESPONSE_DEADLINE_PASSED: "回答締切を過ぎています。",
      RESPONSE_EDIT_FORBIDDEN: "この回答を変更する権限がありません。",
      PARTICIPANT_NOT_FOUND: "変更する回答が見つかりません。",
      TIMEOUT: "保存がタイムアウトしました。",
      NETWORK_ERROR: "通信に失敗しました。",
    };
    return messages[error?.code] || "回答を保存できませんでした。";
  }

  responseForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = el("#participant-name").value.trim();
    const responses = selectedResponses();
    if (!name) {
      el("#participant-name-error").textContent = "名前を入力してください。";
      el("#participant-name").focus();
      return;
    }
    if (responses.length === 0) {
      el("#response-form-error").textContent = "○・△・×を1件以上選択してください。";
      return;
    }
    el("#submit-response-button").disabled = true;
    el("#response-notice").hidden = true;
    try {
      const result = currentParticipantId
        ? await window.TeamSyncApi.updateResponses({
            eventId, participantId: currentParticipantId, name,
            editToken: currentParticipantToken, responses,
          })
        : await window.TeamSyncApi.submitResponses({ eventId, name, responses });
      if (!currentParticipantId) {
        window.TeamSyncSecrets.saveParticipantToken(eventId, result.participantId, result.participantToken);
      }
      window.location.assign(canonicalEventUrl());
    } catch (error) {
      el("#response-notice").textContent = responseError(error);
      el("#response-notice").className = "phase-notice is-error";
      el("#response-notice").hidden = false;
      el("#submit-response-button").disabled = false;
    }
  });

  async function load() {
    if (!UUID_PATTERN.test(eventId) || (participantIdFromUrl && !UUID_PATTERN.test(participantIdFromUrl))) {
      showPageError("URLが正しくありません。共有されたURLを確認してください。");
      return;
    }
    if (!window.TeamSyncApi?.isConfigured?.()) {
      showPageError("イベントの読み込み設定が完了していません。");
      return;
    }
    try {
      currentEvent = await window.TeamSyncApi.getEvent(eventId);
      if (!currentEvent) {
        showPageError("イベントが見つかりませんでした。");
        return;
      }
      adminToken = window.TeamSyncSecrets.getOrganizerToken(eventId);
      if (adminToken) {
        try {
          await window.TeamSyncApi.getAdminEvent(eventId, adminToken);
          isAdmin = true;
        } catch {
          window.TeamSyncSecrets.clearOrganizerToken(eventId);
          adminToken = "";
        }
      }

      renderCommonEvent();
      if (isResponsePage) {
        renderResponsePage();
        if (participantIdFromUrl && !deadlinePassed()) {
          const results = await window.TeamSyncApi.getEventResults(eventId);
          const participant = results?.participants?.find((item) => item.id === participantIdFromUrl);
          if (!participant || !populateParticipant(participant)) return;
        }
      } else {
        renderEventPage();
        await loadResults();
      }
    } catch {
      showPageError("イベントを読み込めませんでした。時間をおいて再度お試しください。");
    }
  }

  el("#copy-url-button")?.addEventListener("click", copyShareUrl);
  el("#refresh-results-button")?.addEventListener("click", loadResults);
  el("#download-csv-button")?.addEventListener("click", downloadCsv);
  load();
})();
