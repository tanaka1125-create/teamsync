const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "supabase.js"), "utf8");

function loadApi(fetchMock) {
  const storage = new Map();
  const window = {
    TeamSyncConfig: {
      supabaseUrl: "https://example.supabase.co/",
      supabasePublicKey: "sb_publishable_example",
    },
    setTimeout,
    clearTimeout,
    location: { hash: "" },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  };
  const context = vm.createContext({
    window, fetch: fetchMock, URL, URLSearchParams, AbortController,
    Error, JSON, Object, String, Array,
  });
  vm.runInContext(source, context, { filename: "js/supabase.js" });
  return { api: window.TeamSyncApi, secrets: window.TeamSyncSecrets };
}

function response(payload, ok = true) {
  return { ok, json: async () => payload };
}

async function main() {
  const calls = [];
  const queue = [
    { eventId: "11111111-1111-4111-8111-111111111111", organizerToken: "admin-token" },
    {
      id: "11111111-1111-4111-8111-111111111111", title: "練習",
      dates: [], responsesProtected: true,
    },
    { participantCount: 0, counts: [], participants: [] },
    { participantId: "33333333-3333-4333-8333-333333333333", participantToken: "edit-token", savedCount: 1 },
    { participantId: "33333333-3333-4333-8333-333333333333", savedCount: 1 },
    { id: "11111111-1111-4111-8111-111111111111", title: "練習", dates: [] },
    { id: "11111111-1111-4111-8111-111111111111", title: "更新", dates: [] },
    { id: "11111111-1111-4111-8111-111111111111", title: "更新", dates: [] },
    true, true, true,
  ];
  const { api, secrets } = loadApi(async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body), headers: options.headers });
    return response(queue.shift());
  });

  assert.equal(api.isConfigured(), true);
  const created = await api.createEvent({
    title: " 練習 ", description: "", responseDeadline: null,
    responsesProtected: true,
    candidates: [{ date: "2026-08-20", startTime: "20:00", endTime: "22:00" }],
  });
  assert.equal(created.organizerToken, "admin-token");
  assert.match(calls[0].url, /create_event_with_dates_v2$/);
  assert.equal(calls[0].body.p_responses_protected, true);
  assert.equal(calls[0].headers.Authorization, undefined);

  assert.equal((await api.getEvent(created.eventId)).title, "練習");
  assert.equal((await api.getEventResults(created.eventId)).participantCount, 0);

  const submitted = await api.submitResponses({
    eventId: created.eventId, name: " たなか ",
    responses: [{ eventDateId: "22222222-2222-4222-8222-222222222222", status: "yes", comment: " OK " }],
  });
  assert.equal(submitted.participantToken, "edit-token");
  assert.match(calls[3].url, /submit_event_responses$/);
  assert.equal(calls[3].body.p_name, "たなか");

  await api.updateResponses({
    eventId: created.eventId,
    participantId: submitted.participantId,
    name: "田中",
    editToken: "edit-token",
    responses: [{ eventDateId: "22222222-2222-4222-8222-222222222222", status: "maybe", comment: "" }],
  });
  assert.match(calls[4].url, /update_event_responses_v2$/);
  assert.equal(calls[4].body.p_edit_token, "edit-token");
  assert.equal(calls[4].body.p_name, "田中");

  await api.getAdminEvent(created.eventId, "admin-token");
  await api.updateEventSettings({
    eventId: created.eventId, adminToken: "admin-token", title: "更新",
    description: "", responseDeadline: null, responsesProtected: true,
    dates: [{ id: null, eventDate: "2026-08-21", startTime: "20:00", endTime: "22:00" }],
  });
  await api.setConfirmedDate(created.eventId, "admin-token", null);
  await api.reorderParticipants(created.eventId, "admin-token", []);
  await api.adminDeleteParticipant(created.eventId, "admin-token", submitted.participantId);
  await api.adminDeleteEvent(created.eventId, "admin-token");
  assert.match(calls[6].url, /update_event_settings$/);
  assert.match(calls[8].url, /admin_reorder_participants$/);
  assert.match(calls[10].url, /admin_delete_event$/);

  secrets.saveOrganizerToken(created.eventId, "admin-token");
  assert.equal(secrets.getOrganizerToken(created.eventId), "admin-token");
  secrets.saveParticipantToken(created.eventId, submitted.participantId, "edit-token");
  assert.equal(secrets.getParticipantToken(created.eventId, submitted.participantId), "edit-token");

  const { api: errorApi } = loadApi(async () => response({ message: "RESPONSE_EDIT_FORBIDDEN" }, false));
  await assert.rejects(
    () => errorApi.updateResponses({
      eventId: created.eventId, participantId: submitted.participantId,
      name: "田中", editToken: "", responses: [],
    }),
    (error) => error.code === "RESPONSE_EDIT_FORBIDDEN",
  );

  console.log("Supabase Phase 8 API checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
