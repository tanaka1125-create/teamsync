/**
 * Minimal Supabase REST client for TeamSync.
 * Uses the database function defined in supabase/schema.sql.
 */
(function initializeSupabaseApi() {
  "use strict";

  const REQUEST_TIMEOUT_MS = 15000;
  const config = window.TeamSyncConfig ?? {};
  const supabaseUrl = String(config.supabaseUrl ?? "")
    .trim()
    .replace(/\/$/, "");
  const supabasePublicKey = String(
    config.supabasePublicKey ?? config.supabaseAnonKey ?? "",
  ).trim();

  function isConfigured() {
    if (!supabaseUrl || !supabasePublicKey) {
      return false;
    }

    try {
      const url = new URL(supabaseUrl);
      return (url.protocol === "https:" || url.hostname === "localhost") && Boolean(url.host);
    } catch {
      return false;
    }
  }

  function createRequestHeaders() {
    const headers = {
      apikey: supabasePublicKey,
      "Content-Type": "application/json",
    };

    // Legacy anon keys are JWTs and are also accepted as a bearer token.
    // New sb_publishable_ keys are not JWTs, so they must not be sent here.
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

  async function callRpc(functionName, requestBody) {
    if (!isConfigured()) {
      throw createApiError(
        "NOT_CONFIGURED",
        "Supabaseの接続情報が設定されていません。",
      );
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
        throw createApiError("SUPABASE_ERROR", message);
      }

      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw createApiError(
          "TIMEOUT",
          "Supabaseへの接続がタイムアウトしました。",
          error,
        );
      }

      if (error.name === "TeamSyncApiError") {
        throw error;
      }

      throw createApiError(
        "NETWORK_ERROR",
        "Supabaseに接続できませんでした。通信環境を確認してください。",
        error,
      );
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function createEvent(eventData) {
    const requestBody = {
      p_title: eventData.title.trim(),
      p_description: eventData.description.trim() || null,
      p_dates: eventData.candidates.map((candidate) => ({
        event_date: candidate.date,
        start_time: candidate.startTime,
        end_time: candidate.endTime,
      })),
    };

    const eventId = await callRpc("create_event_with_dates", requestBody);

    if (typeof eventId !== "string" || !eventId) {
      throw createApiError(
        "INVALID_RESPONSE",
        "SupabaseからイベントIDを取得できませんでした。",
      );
    }

    return eventId;
  }

  async function getEvent(eventId) {
    const eventData = await callRpc("get_event_details", {
      p_event_id: eventId,
    });

    if (eventData === null) {
      return null;
    }

    if (
      typeof eventData !== "object" ||
      typeof eventData.id !== "string" ||
      typeof eventData.title !== "string" ||
      !Array.isArray(eventData.dates)
    ) {
      throw createApiError(
        "INVALID_RESPONSE",
        "Supabaseからイベント情報を取得できませんでした。",
      );
    }

    return eventData;
  }

  async function submitResponses(responseData) {
    const result = await callRpc("submit_event_responses", {
      p_event_id: responseData.eventId,
      p_name: responseData.name.trim(),
      p_responses: responseData.responses.map((response) => ({
        event_date_id: response.eventDateId,
        status: response.status,
        comment: response.comment.trim() || null,
      })),
    });

    if (
      typeof result !== "object" ||
      typeof result.participantId !== "string" ||
      typeof result.savedCount !== "number"
    ) {
      throw createApiError(
        "INVALID_RESPONSE",
        "Supabaseから回答の保存結果を取得できませんでした。",
      );
    }

    return result;
  }

  window.TeamSyncApi = Object.freeze({
    isConfigured,
    createEvent,
    getEvent,
    submitResponses,
  });
})();
