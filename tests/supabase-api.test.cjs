const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const apiSource = fs.readFileSync(
  path.join(projectRoot, "js", "supabase.js"),
  "utf8",
);

function loadApi(config, fetchMock) {
  const window = {
    TeamSyncConfig: config,
    setTimeout,
    clearTimeout,
  };
  const context = vm.createContext({
    window,
    fetch: fetchMock,
    URL,
    AbortController,
    Error,
    JSON,
    Object,
    String,
  });

  vm.runInContext(apiSource, context, { filename: "js/supabase.js" });
  return window.TeamSyncApi;
}

async function testSuccessfulCreate() {
  let capturedRequest;
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co/",
      supabasePublicKey: "sb_publishable_example",
    },
    async (url, options) => {
      capturedRequest = { url, options };
      return {
        ok: true,
        json: async () => "11111111-1111-4111-8111-111111111111",
      };
    },
  );

  assert.equal(api.isConfigured(), true);
  const eventId = await api.createEvent({
    title: "  チーム練習  ",
    description: "  参加できる日時を選択  ",
    candidates: [
      {
        date: "2026-08-14",
        startTime: "20:00",
        endTime: "22:00",
      },
    ],
  });

  assert.equal(eventId, "11111111-1111-4111-8111-111111111111");
  assert.equal(
    capturedRequest.url,
    "https://example.supabase.co/rest/v1/rpc/create_event_with_dates",
  );
  assert.equal(capturedRequest.options.method, "POST");
  assert.equal(capturedRequest.options.headers.apikey, "sb_publishable_example");
  assert.equal(capturedRequest.options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    p_title: "チーム練習",
    p_description: "参加できる日時を選択",
    p_dates: [
      {
        event_date: "2026-08-14",
        start_time: "20:00",
        end_time: "22:00",
      },
    ],
  });
}

async function testSuccessfulRead() {
  let capturedRequest;
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co/",
      supabasePublicKey: "sb_publishable_example",
    },
    async (url, options) => {
      capturedRequest = { url, options };
      return {
        ok: true,
        json: async () => ({
          id: "11111111-1111-4111-8111-111111111111",
          title: "チーム練習",
          description: "参加できる日時を確認してください。",
          dates: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              eventDate: "2026-08-14",
              startTime: "20:00",
              endTime: "22:00",
            },
          ],
        }),
      };
    },
  );

  const eventData = await api.getEvent("11111111-1111-4111-8111-111111111111");
  assert.equal(eventData.title, "チーム練習");
  assert.equal(eventData.dates.length, 1);
  assert.equal(
    capturedRequest.url,
    "https://example.supabase.co/rest/v1/rpc/get_event_details",
  );
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    p_event_id: "11111111-1111-4111-8111-111111111111",
  });
}

async function testMissingEvent() {
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co",
      supabasePublicKey: "sb_publishable_example",
    },
    async () => ({ ok: true, json: async () => null }),
  );

  assert.equal(
    await api.getEvent("11111111-1111-4111-8111-111111111111"),
    null,
  );
}

async function testSuccessfulResultsRead() {
  let capturedRequest;
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co/",
      supabasePublicKey: "sb_publishable_example",
    },
    async (url, options) => {
      capturedRequest = { url, options };
      return {
        ok: true,
        json: async () => ({
          participantCount: 2,
          counts: [
            {
              eventDateId: "22222222-2222-4222-8222-222222222222",
              yesCount: 1,
              maybeCount: 0,
              noCount: 0,
              unansweredCount: 1,
            },
          ],
          participants: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              name: "たなか",
              responses: [
                {
                  eventDateId: "22222222-2222-4222-8222-222222222222",
                  status: "yes",
                  comment: "参加できます",
                },
              ],
            },
          ],
        }),
      };
    },
  );

  const results = await api.getEventResults(
    "11111111-1111-4111-8111-111111111111",
  );

  assert.equal(results.participantCount, 2);
  assert.equal(results.counts[0].yesCount, 1);
  assert.equal(results.participants[0].responses[0].comment, "参加できます");
  assert.equal(
    capturedRequest.url,
    "https://example.supabase.co/rest/v1/rpc/get_event_results",
  );
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    p_event_id: "11111111-1111-4111-8111-111111111111",
  });
}

async function testInvalidResultsRead() {
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co",
      supabasePublicKey: "sb_publishable_example",
    },
    async () => ({
      ok: true,
      json: async () => ({ participantCount: "2", counts: [], participants: [] }),
    }),
  );

  await assert.rejects(
    () => api.getEventResults("11111111-1111-4111-8111-111111111111"),
    (error) => error.code === "INVALID_RESPONSE",
  );
}

async function testSuccessfulResponseSubmit() {
  let capturedRequest;
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co/",
      supabasePublicKey: "sb_publishable_example",
    },
    async (url, options) => {
      capturedRequest = { url, options };
      return {
        ok: true,
        json: async () => ({
          participantId: "33333333-3333-4333-8333-333333333333",
          savedCount: 2,
        }),
      };
    },
  );

  const result = await api.submitResponses({
    eventId: "11111111-1111-4111-8111-111111111111",
    name: "  たなか  ",
    responses: [
      {
        eventDateId: "22222222-2222-4222-8222-222222222222",
        status: "yes",
        comment: "  参加できます  ",
      },
      {
        eventDateId: "44444444-4444-4444-8444-444444444444",
        status: "maybe",
        comment: "",
      },
    ],
  });

  assert.equal(result.savedCount, 2);
  assert.equal(
    capturedRequest.url,
    "https://example.supabase.co/rest/v1/rpc/submit_event_responses",
  );
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    p_event_id: "11111111-1111-4111-8111-111111111111",
    p_name: "たなか",
    p_responses: [
      {
        event_date_id: "22222222-2222-4222-8222-222222222222",
        status: "yes",
        comment: "参加できます",
      },
      {
        event_date_id: "44444444-4444-4444-8444-444444444444",
        status: "maybe",
        comment: null,
      },
    ],
  });
}

async function testInvalidResponseSubmitResult() {
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co",
      supabasePublicKey: "sb_publishable_example",
    },
    async () => ({ ok: true, json: async () => ({ savedCount: "1" }) }),
  );

  await assert.rejects(
    () =>
      api.submitResponses({
        eventId: "11111111-1111-4111-8111-111111111111",
        name: "たなか",
        responses: [
          {
            eventDateId: "22222222-2222-4222-8222-222222222222",
            status: "yes",
            comment: "",
          },
        ],
      }),
    (error) => error.code === "INVALID_RESPONSE",
  );
}

async function testSuccessfulResponseUpdate() {
  let capturedRequest;
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co/",
      supabasePublicKey: "sb_publishable_example",
    },
    async (url, options) => {
      capturedRequest = { url, options };
      return {
        ok: true,
        json: async () => ({
          participantId: "33333333-3333-4333-8333-333333333333",
          savedCount: 1,
        }),
      };
    },
  );

  const result = await api.updateResponses({
    eventId: "11111111-1111-4111-8111-111111111111",
    participantId: "33333333-3333-4333-8333-333333333333",
    responses: [
      {
        eventDateId: "22222222-2222-4222-8222-222222222222",
        status: "no",
        comment: "  予定が変わりました  ",
      },
    ],
  });

  assert.equal(result.savedCount, 1);
  assert.equal(
    capturedRequest.url,
    "https://example.supabase.co/rest/v1/rpc/update_event_responses",
  );
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    p_event_id: "11111111-1111-4111-8111-111111111111",
    p_participant_id: "33333333-3333-4333-8333-333333333333",
    p_responses: [
      {
        event_date_id: "22222222-2222-4222-8222-222222222222",
        status: "no",
        comment: "予定が変わりました",
      },
    ],
  });
}

async function testSuccessfulParticipantDelete() {
  let capturedRequest;
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co/",
      supabasePublicKey: "sb_publishable_example",
    },
    async (url, options) => {
      capturedRequest = { url, options };
      return {
        ok: true,
        json: async () => ({
          participantId: "33333333-3333-4333-8333-333333333333",
          deleted: true,
        }),
      };
    },
  );

  const result = await api.deleteParticipant({
    eventId: "11111111-1111-4111-8111-111111111111",
    participantId: "33333333-3333-4333-8333-333333333333",
  });

  assert.equal(result.deleted, true);
  assert.equal(
    capturedRequest.url,
    "https://example.supabase.co/rest/v1/rpc/delete_event_participant",
  );
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    p_event_id: "11111111-1111-4111-8111-111111111111",
    p_participant_id: "33333333-3333-4333-8333-333333333333",
  });
}

async function testDuplicateParticipantError() {
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co",
      supabasePublicKey: "sb_publishable_example",
    },
    async () => ({
      ok: false,
      json: async () => ({ message: "PARTICIPANT_NAME_EXISTS" }),
    }),
  );

  await assert.rejects(
    () =>
      api.submitResponses({
        eventId: "11111111-1111-4111-8111-111111111111",
        name: "たなか",
        responses: [
          {
            eventDateId: "22222222-2222-4222-8222-222222222222",
            status: "yes",
            comment: "",
          },
        ],
      }),
    (error) => error.code === "PARTICIPANT_NAME_EXISTS",
  );
}

async function testMissingConfiguration() {
  let fetchCalled = false;
  const api = loadApi(
    { supabaseUrl: "", supabasePublicKey: "" },
    async () => {
      fetchCalled = true;
    },
  );

  assert.equal(api.isConfigured(), false);
  await assert.rejects(
    () =>
      api.createEvent({
        title: "テスト",
        description: "",
        candidates: [],
      }),
    (error) => error.code === "NOT_CONFIGURED",
  );
  assert.equal(fetchCalled, false);
}

async function testSupabaseError() {
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co",
      supabasePublicKey: "sb_publishable_example",
    },
    async () => ({
      ok: false,
      json: async () => ({ message: "validation failed" }),
    }),
  );

  await assert.rejects(
    () =>
      api.createEvent({
        title: "テスト",
        description: "",
        candidates: [
          { date: "2026-08-14", startTime: "20:00", endTime: "22:00" },
        ],
      }),
    (error) => error.code === "SUPABASE_ERROR",
  );
}

async function testLegacyAnonAuthorization() {
  let capturedHeaders;
  const legacyAnonKey = "eyJlegacy-anon-jwt";
  const api = loadApi(
    {
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: legacyAnonKey,
    },
    async (_url, options) => {
      capturedHeaders = options.headers;
      return {
        ok: true,
        json: async () => "11111111-1111-4111-8111-111111111111",
      };
    },
  );

  await api.createEvent({
    title: "test",
    description: "",
    candidates: [
      { date: "2026-08-14", startTime: "20:00", endTime: "22:00" },
    ],
  });

  assert.equal(capturedHeaders.apikey, legacyAnonKey);
  assert.equal(capturedHeaders.Authorization, `Bearer ${legacyAnonKey}`);
}

function testSchemaGuards() {
  const schema = fs.readFileSync(
    path.join(projectRoot, "supabase", "schema.sql"),
    "utf8",
  );

  const requiredPatterns = [
    /enable row level security/,
    /security definer/,
    /revoke all on table public\.events from anon/,
    /revoke all on table public\.event_dates from anon/,
    /revoke all on table public\.participants from anon/,
    /revoke all on table public\.responses from anon/,
    /grant execute on function public\.create_event_with_dates/,
    /create or replace function public\.get_event_details/,
    /grant execute on function public\.get_event_details\(uuid\) to anon/,
    /create or replace function public\.get_event_results/,
    /grant execute on function public\.get_event_results\(uuid\) to anon/,
    /'participantCount'/,
    /'unansweredCount'/,
    /count\(\*\) filter \(where response\.status = 'yes'\)/,
    /create or replace function public\.submit_event_responses/,
    /grant execute on function public\.submit_event_responses\(uuid, text, jsonb\) to anon/,
    /raise exception 'PARTICIPANT_NAME_EXISTS'/,
    /create or replace function public\.update_event_responses/,
    /grant execute on function public\.update_event_responses\(uuid, uuid, jsonb\) to anon/,
    /create or replace function public\.delete_event_participant/,
    /grant execute on function public\.delete_event_participant\(uuid, uuid\) to anon/,
    /delete from public\.participants/,
    /delete from public\.responses/,
    /constraint participants_unique_name unique \(event_id, name_key\)/,
    /constraint responses_unique_candidate unique \(participant_id, event_date_id\)/,
    /status text not null check \(status in \('yes', 'maybe', 'no'\)\)/,
    /revoke all on function public\.get_event_details\(uuid\)[\s\S]*from public, authenticated/,
    /grant usage on schema public to anon/,
    /from public, authenticated/,
    /jsonb_array_length\(p_dates\) not between 1 and 10/,
    /start_time::time >= item\.end_time::time/,
  ];

  requiredPatterns.forEach((pattern) => assert.match(schema, pattern));
}

async function main() {
  await testSuccessfulCreate();
  await testSuccessfulRead();
  await testMissingEvent();
  await testSuccessfulResultsRead();
  await testInvalidResultsRead();
  await testSuccessfulResponseSubmit();
  await testInvalidResponseSubmitResult();
  await testSuccessfulResponseUpdate();
  await testSuccessfulParticipantDelete();
  await testDuplicateParticipantError();
  await testMissingConfiguration();
  await testSupabaseError();
  await testLegacyAnonAuthorization();
  testSchemaGuards();
  console.log("Supabase API and schema checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
