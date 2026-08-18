/**
 * TeamSync Supabase REST client.
 * All writes go through validated database functions in supabase/schema.sql
 * and supabase/phase8.sql.
 */
(function initializeSupabaseApi() {
  "use strict";

  const REQUEST_TIMEOUT_MS = 15000;
  const config = window.TeamSyncConfig ?? {};
  const supabaseUrl = String(config.supabaseUrl ?? "").trim().replace(/\/$/, "");
  const supabasePublicKey = String(
    config.supabasePublicKey ?? config.supabaseAnonKey ?? "",
  ).trim();

  function isConfigured() {
    if (!supabaseUrl || !supabasePublicKey) return false;
    try {
      const url = new URL(supabaseUrl);
      return (url.protocol === "https:" || url.hostname === "localhost") && Boolean(url.host);
    } catch {
      return false;
    }
  }

  function createRequestHeaders() {
    const headers = { apikey: supabasePublicKey, "Content-Type": "application/json" };
    if (supabasePublicKey.startsWith("eyJ")) {
      headers.Authorization = `Bearer ${supabasePublicKey}`;
    }
    return headers;
  }

  function createApiError(code, message, cause) {
    const error = new Error(message, cause ? { cause } : undefined);
    error.name = "TeamSyncApiError";
    error.code = code;
    return error;
  }

  async function readErrorMessage(response) {
    try {
      const payload = await response.json();
      return payload.message || payload.hint || payload.details || "Supabaseでエラーが発生しました。";
    } catch {
      return "Supabaseでエラーが発生しました。";
    }
  }

  function getSupabaseErrorCode(message) {
    const knownCodes = [
      "PARTICIPANT_NAME_EXISTS",
      "PARTICIPANT_NOT_FOUND",
      "RESPONSE_DEADLINE_PASSED",
      "RESPONSE_EDIT_FORBIDDEN",
      "ADMIN_FORBIDDEN",
    ];
    return knownCodes.find((code) => message.includes(code)) || "SUPABASE_ERROR";
  }

  async function callRpc(functionName, requestBody) {
    if (!isConfigured()) {
      throw createApiError("NOT_CONFIGURED", "Supabaseの接続情報が設定されていません。");
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
        method: "POST",
        headers: createRequestHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw createApiError(getSupabaseErrorCode(message), message);
      }
      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw createApiError("TIMEOUT", "Supabaseへの接続がタイムアウトしました。", error);
      }
      if (error.name === "TeamSyncApiError") throw error;
      throw createApiError("NETWORK_ERROR", "Supabaseに接続できませんでした。", error);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function assertObject(value, message) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw createApiError("INVALID_RESPONSE", message);
    }
    return value;
  }

  async function createEvent(eventData) {
    const result = assertObject(
      await callRpc("create_event_with_dates_v2", {
        p_title: eventData.title.trim(),
        p_description: eventData.description.trim() || null,
        p_dates: eventData.candidates.map((candidate) => ({
          event_date: candidate.date,
          start_time: candidate.startTime,
          end_time: candidate.endTime,
        })),
        p_response_deadline: eventData.responseDeadline || null,
        p_responses_protected: eventData.responsesProtected !== false,
      }),
      "イベントの作成結果を取得できませんでした。",
    );
    if (typeof result.eventId !== "string" || typeof result.organizerToken !== "string") {
      throw createApiError("INVALID_RESPONSE", "イベントの作成結果を取得できませんでした。");
    }
    return result;
  }

  async function getEvent(eventId) {
    const eventData = await callRpc("get_event_details", { p_event_id: eventId });
    if (eventData === null) return null;
    assertObject(eventData, "イベント情報を取得できませんでした。");
    if (typeof eventData.id !== "string" || !Array.isArray(eventData.dates)) {
      throw createApiError("INVALID_RESPONSE", "イベント情報を取得できませんでした。");
    }
    return eventData;
  }

  async function getEventResults(eventId) {
    const results = await callRpc("get_event_results", { p_event_id: eventId });
    if (results === null) return null;
    assertObject(results, "回答結果を取得できませんでした。");
    if (typeof results.participantCount !== "number" || !Array.isArray(results.counts) || !Array.isArray(results.participants)) {
      throw createApiError("INVALID_RESPONSE", "回答結果を取得できませんでした。");
    }
    return results;
  }

  async function submitResponses(responseData) {
    const result = assertObject(
      await callRpc("submit_event_responses", {
        p_event_id: responseData.eventId,
        p_name: responseData.name.trim(),
        p_responses: normalizeResponses(responseData.responses),
      }),
      "回答の保存結果を取得できませんでした。",
    );
    if (typeof result.participantId !== "string" || typeof result.participantToken !== "string" || typeof result.savedCount !== "number") {
      throw createApiError("INVALID_RESPONSE", "回答の保存結果を取得できませんでした。");
    }
    return result;
  }

  async function updateResponses(responseData) {
    const result = assertObject(
      await callRpc("update_event_responses_v2", {
        p_event_id: responseData.eventId,
        p_participant_id: responseData.participantId,
        p_name: responseData.name.trim(),
        p_edit_token: responseData.editToken || null,
        p_responses: normalizeResponses(responseData.responses),
      }),
      "回答の変更結果を取得できませんでした。",
    );
    if (typeof result.participantId !== "string" || typeof result.savedCount !== "number") {
      throw createApiError("INVALID_RESPONSE", "回答の変更結果を取得できませんでした。");
    }
    return result;
  }

  function normalizeResponses(responses) {
    return responses.map((response) => ({
      event_date_id: response.eventDateId,
      status: response.status,
      comment: response.comment.trim() || null,
    }));
  }

  async function getAdminEvent(eventId, adminToken) {
    return callRpc("get_event_admin_details", {
      p_event_id: eventId,
      p_admin_token: adminToken,
    });
  }

  async function updateEventSettings(data) {
    return callRpc("update_event_settings", {
      p_event_id: data.eventId,
      p_admin_token: data.adminToken,
      p_title: data.title.trim(),
      p_description: data.description.trim() || null,
      p_response_deadline: data.responseDeadline || null,
      p_responses_protected: data.responsesProtected,
      p_dates: data.dates.map((candidate) => ({
        id: candidate.id || null,
        event_date: candidate.eventDate,
        start_time: candidate.startTime,
        end_time: candidate.endTime,
      })),
    });
  }

  async function setConfirmedDate(eventId, adminToken, eventDateId) {
    return callRpc("admin_set_confirmed_date", {
      p_event_id: eventId,
      p_admin_token: adminToken,
      p_event_date_id: eventDateId || null,
    });
  }

  async function reorderParticipants(eventId, adminToken, participantIds) {
    return callRpc("admin_reorder_participants", {
      p_event_id: eventId,
      p_admin_token: adminToken,
      p_participant_ids: participantIds,
    });
  }

  async function adminDeleteParticipant(eventId, adminToken, participantId) {
    return callRpc("admin_delete_participant", {
      p_event_id: eventId,
      p_admin_token: adminToken,
      p_participant_id: participantId,
    });
  }

  async function adminDeleteEvent(eventId, adminToken) {
    return callRpc("admin_delete_event", {
      p_event_id: eventId,
      p_admin_token: adminToken,
    });
  }

  window.TeamSyncApi = Object.freeze({
    isConfigured,
    createEvent,
    getEvent,
    getEventResults,
    submitResponses,
    updateResponses,
    getAdminEvent,
    updateEventSettings,
    setConfirmedDate,
    reorderParticipants,
    adminDeleteParticipant,
    adminDeleteEvent,
  });
})();

(function initializeTeamSyncSecrets() {
  "use strict";

  function read(key) {
    try { return window.localStorage.getItem(key) || ""; } catch { return ""; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* storage is optional */ }
  }
  function remove(key) {
    try { window.localStorage.removeItem(key); } catch { /* storage is optional */ }
  }
  function organizerKey(eventId) { return `teamsync:organizer:${eventId}`; }
  function participantKey(eventId, participantId) {
    return `teamsync:participant:${eventId}:${participantId}`;
  }
  function getHashAdminToken() {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    return new URLSearchParams(hash).get("admin")?.trim() || "";
  }
  function getOrganizerToken(eventId) {
    const fromHash = getHashAdminToken();
    if (fromHash) write(organizerKey(eventId), fromHash);
    return fromHash || read(organizerKey(eventId));
  }

  window.TeamSyncSecrets = Object.freeze({
    saveOrganizerToken(eventId, token) { write(organizerKey(eventId), token); },
    getOrganizerToken,
    clearOrganizerToken(eventId) { remove(organizerKey(eventId)); },
    saveParticipantToken(eventId, participantId, token) {
      write(participantKey(eventId, participantId), token);
    },
    getParticipantToken(eventId, participantId) {
      return read(participantKey(eventId, participantId));
    },
  });
})();
