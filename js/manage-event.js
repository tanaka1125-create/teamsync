(function initializeManageEvent() {
  "use strict";

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const query = new URLSearchParams(window.location.search);
  const eventId = query.get("id")?.trim() || "";
  let adminToken = "";
  let eventData = null;
  let candidates = [];

  const el = (selector) => document.querySelector(selector);

  function eventUrl() {
    const url = new URL("event.html", window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("id", eventId);
    return url.href;
  }

  function adminUrl() {
    const url = new URL("manage.html", window.location.href);
    url.search = "";
    url.searchParams.set("id", eventId);
    url.hash = new URLSearchParams({ admin: adminToken }).toString();
    return url.href;
  }

  function showError(message) {
    el("#manage-loading").hidden = true;
    el("#manage-content").hidden = true;
    el("#manage-error-message").textContent = message;
    el("#manage-error-back").href = eventUrl();
    el("#manage-error").hidden = false;
  }

  function showNotice(message, type) {
    const notice = el("#manage-notice");
    notice.textContent = message;
    notice.className = `phase-notice is-${type}`;
    notice.hidden = false;
  }

  function toLocalDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function candidateLabel(candidate) {
    return `${candidate.eventDate} ${candidate.startTime}〜${candidate.endTime}`;
  }

  function createCandidateRow(candidate, index) {
    const row = document.createElement("div");
    row.className = "manage-candidate-row";
    row.dataset.id = candidate.id || "";

    const date = document.createElement("input");
    date.type = "date";
    date.value = candidate.eventDate;
    date.required = true;
    date.setAttribute("aria-label", `候補${index + 1}の日付`);

    const start = document.createElement("input");
    start.type = "time";
    start.step = "1800";
    start.value = candidate.startTime;
    start.required = true;
    start.setAttribute("aria-label", `候補${index + 1}の開始時刻`);

    const end = document.createElement("input");
    end.type = "time";
    end.step = "1800";
    end.value = candidate.endTime === "24:00" ? "23:59" : candidate.endTime;
    end.required = true;
    end.setAttribute("aria-label", `候補${index + 1}の終了時刻`);

    const actions = document.createElement("div");
    actions.className = "candidate-row-actions";
    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "↑";
    up.title = "上へ";
    up.disabled = index === 0;
    up.addEventListener("click", () => moveCandidate(index, -1));
    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "↓";
    down.title = "下へ";
    down.disabled = index === candidates.length - 1;
    down.addEventListener("click", () => moveCandidate(index, 1));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "削除";
    remove.disabled = candidates.length === 1;
    remove.addEventListener("click", () => {
      syncCandidateValues();
      candidates.splice(index, 1);
      renderCandidates();
    });
    actions.append(up, down, remove);
    row.append(date, start, document.createTextNode("〜"), end, actions);
    return row;
  }

  function syncCandidateValues() {
    el("#manage-candidate-list").querySelectorAll(".manage-candidate-row").forEach((row, index) => {
      const inputs = row.querySelectorAll("input");
      candidates[index] = {
        id: row.dataset.id || null,
        eventDate: inputs[0].value,
        startTime: inputs[1].value,
        endTime: inputs[2].value,
      };
    });
  }

  function renderCandidates() {
    el("#manage-candidate-list").replaceChildren(...candidates.map(createCandidateRow));
    el("#add-candidate-button").disabled = candidates.length >= 30;
  }

  function moveCandidate(index, offset) {
    syncCandidateValues();
    const next = index + offset;
    [candidates[index], candidates[next]] = [candidates[next], candidates[index]];
    renderCandidates();
  }

  function renderConfirmedOptions() {
    const select = el("#confirmed-date-select");
    const selected = eventData.confirmedEventDateId || "";
    select.replaceChildren(new Option("未確定", ""));
    candidates.filter((candidate) => candidate.id).forEach((candidate) => {
      select.add(new Option(candidateLabel(candidate), candidate.id));
    });
    select.value = selected;
  }

  function render() {
    candidates = eventData.dates.map((candidate) => ({ ...candidate }));
    el("#manage-title").value = eventData.title;
    el("#manage-description").value = eventData.description || "";
    el("#manage-deadline").value = toLocalDateTime(eventData.responseDeadline);
    el("#manage-protected").checked = eventData.responsesProtected;
    el("#back-to-event").href = eventUrl();
    el("#admin-url").textContent = adminUrl();
    renderCandidates();
    renderConfirmedOptions();
    el("#manage-loading").hidden = true;
    el("#manage-error").hidden = true;
    el("#manage-content").hidden = false;
    document.title = `${eventData.title}の幹事メニュー | TeamSync`;
  }

  function validateCandidates() {
    const dates = new Set();
    for (const candidate of candidates) {
      if (!candidate.eventDate || !candidate.startTime || !candidate.endTime) {
        return "候補日時をすべて入力してください。";
      }
      if (candidate.startTime >= candidate.endTime) {
        return "終了時刻は開始時刻より後にしてください。";
      }
      if (dates.has(candidate.eventDate)) return "同じ候補日を重複して設定できません。";
      dates.add(candidate.eventDate);
    }
    return "";
  }

  el("#add-candidate-button").addEventListener("click", () => {
    syncCandidateValues();
    const today = new Date();
    candidates.push({
      id: null,
      eventDate: today.toISOString().slice(0, 10),
      startTime: "20:00",
      endTime: "22:00",
    });
    renderCandidates();
  });

  el("#manage-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    syncCandidateValues();
    const validation = validateCandidates();
    if (validation) {
      showNotice(validation, "error");
      return;
    }
    const button = el("#save-event-button");
    button.disabled = true;
    try {
      eventData = await window.TeamSyncApi.updateEventSettings({
        eventId,
        adminToken,
        title: el("#manage-title").value,
        description: el("#manage-description").value,
        responseDeadline: el("#manage-deadline").value
          ? new Date(el("#manage-deadline").value).toISOString()
          : null,
        responsesProtected: el("#manage-protected").checked,
        dates: candidates,
      });
      showNotice("イベント情報を保存しました。", "success");
      render();
    } catch (error) {
      showNotice(error?.code === "ADMIN_FORBIDDEN"
        ? "幹事用URLが正しくありません。"
        : "イベント情報を保存できませんでした。", "error");
    } finally {
      button.disabled = false;
    }
  });

  el("#confirm-date-button").addEventListener("click", async () => {
    const button = el("#confirm-date-button");
    button.disabled = true;
    try {
      eventData = await window.TeamSyncApi.setConfirmedDate(
        eventId, adminToken, el("#confirmed-date-select").value || null,
      );
      showNotice("開催日の確定状態を保存しました。", "success");
      render();
    } catch {
      showNotice("開催日を確定できませんでした。", "error");
    } finally {
      button.disabled = false;
    }
  });

  el("#copy-admin-url").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(adminUrl());
      el("#copy-admin-url").textContent = "コピーしました";
      window.setTimeout(() => { el("#copy-admin-url").textContent = "幹事用URLをコピー"; }, 2000);
    } catch {
      showNotice("幹事用URLをコピーできませんでした。", "error");
    }
  });

  el("#delete-event-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button.dataset.confirm !== "true") {
      button.dataset.confirm = "true";
      button.textContent = "本当に削除する";
      window.setTimeout(() => {
        if (button.isConnected) {
          button.dataset.confirm = "false";
          button.textContent = "イベントを削除";
        }
      }, 7000);
      return;
    }
    button.disabled = true;
    try {
      await window.TeamSyncApi.adminDeleteEvent(eventId, adminToken);
      window.TeamSyncSecrets.clearOrganizerToken(eventId);
      window.location.assign("index.html");
    } catch {
      showNotice("イベントを削除できませんでした。", "error");
      button.disabled = false;
    }
  });

  async function load() {
    if (!UUID_PATTERN.test(eventId)) {
      showError("イベントURLが正しくありません。");
      return;
    }
    adminToken = window.TeamSyncSecrets.getOrganizerToken(eventId);
    if (!adminToken) {
      showError("幹事用URLから開いてください。");
      return;
    }
    try {
      eventData = await window.TeamSyncApi.getAdminEvent(eventId, adminToken);
      render();
    } catch {
      showError("幹事用URLが正しくないか、このイベントは旧バージョンで作成されています。");
    }
  }

  load();
})();
