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
    /grant execute on function public\.create_event_with_dates/,
    /grant usage on schema public to anon/,
    /from public, authenticated/,
    /jsonb_array_length\(p_dates\) not between 1 and 10/,
    /start_time::time >= item\.end_time::time/,
  ];

  requiredPatterns.forEach((pattern) => assert.match(schema, pattern));
}

async function main() {
  await testSuccessfulCreate();
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
