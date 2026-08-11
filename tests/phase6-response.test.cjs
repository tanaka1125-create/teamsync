const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const responseHtml = fs.readFileSync(
  path.join(projectRoot, "response.html"),
  "utf8",
);
const eventScript = fs.readFileSync(
  path.join(projectRoot, "js", "event.js"),
  "utf8",
);
const schema = fs.readFileSync(
  path.join(projectRoot, "supabase", "schema.sql"),
  "utf8",
);

[
  'id="response-form"',
  'id="participant-name"',
  'id="response-form-error"',
  'id="submit-response-button"',
  'id="response-notice"',
  'id="response-mode-hint"',
  'maxlength="40"',
  'id="back-to-results-link"',
  'src="js/event.js?v=13"',
].forEach((requiredMarkup) => assert.ok(responseHtml.includes(requiredMarkup)));

assert.equal(responseHtml.includes("同じ名前で再回答すると"), false);

assert.match(eventScript, /value: "yes", symbol: "○", label: "参加"/);
assert.match(eventScript, /value: "maybe", symbol: "△", label: "未定"/);
assert.match(eventScript, /value: "no", symbol: "×", label: "不参加"/);
assert.match(eventScript, /comment\.maxLength = 200/);
assert.match(eventScript, /TeamSyncApi\.submitResponses/);
assert.match(eventScript, /TeamSyncApi\.updateResponses/);
assert.match(eventScript, /searchParams\.get\("participant"\)/);
assert.match(eventScript, /populateResponseForEdit\(participant\)/);
assert.match(eventScript, /responses\.length === 0/);
assert.match(eventScript, /window\.location\.assign\(getCanonicalEventUrl\(currentEventId\)\)/);
assert.match(schema, /create table if not exists public\.participants/);
assert.match(schema, /create table if not exists public\.responses/);
assert.match(schema, /raise exception 'PARTICIPANT_NAME_EXISTS'/);
assert.match(schema, /create or replace function public\.update_event_responses/);
assert.match(schema, /grant execute on function public\.update_event_responses\(uuid, uuid, jsonb\) to anon/);
assert.equal(schema.includes("on conflict (event_id, name_key)"), false);

console.log("Phase 6 response page checks passed.");
