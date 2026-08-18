const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const eventScript = read("js/event.js");
const api = read("js/supabase.js");
const migration = read("supabase/phase8.sql");

assert.match(eventScript, /participantCanEdit/);
assert.match(eventScript, /getParticipantToken/);
assert.match(eventScript, /saveParticipantToken/);
assert.match(eventScript, /RESPONSE_EDIT_FORBIDDEN/);
assert.match(eventScript, /RESPONSE_DEADLINE_PASSED/);
assert.match(api, /update_event_responses_v2/);
assert.match(api, /p_edit_token/);
assert.match(api, /participantToken/);

[
  /organizer_token_hash text/,
  /edit_token_hash text/,
  /responses_protected boolean/,
  /response_deadline timestamptz/,
  /digest\(organizer_token, 'sha256'\)/,
  /digest\(participant_token, 'sha256'\)/,
  /raise exception 'RESPONSE_EDIT_FORBIDDEN'/,
  /raise exception 'RESPONSE_DEADLINE_PASSED'/,
  /revoke execute on function public\.update_event_responses\(uuid, uuid, jsonb\)/,
  /revoke execute on function public\.delete_event_participant\(uuid, uuid\)/,
].forEach((pattern) => assert.match(migration, pattern));

console.log("Phase 8 response protection checks passed.");
