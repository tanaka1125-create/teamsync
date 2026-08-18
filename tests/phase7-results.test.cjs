const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const event = read("event.html");
const script = read("js/event.js");
const manage = read("js/manage-event.js");
const style = read("css/style.css");
const migration = read("supabase/phase8.sql");

assert.ok(event.includes('class="attendance-table"'));
assert.ok(!event.includes("おすすめ候補"));
assert.ok(event.includes('js/event.js?v=16'));
assert.doesNotMatch(script, /best-candidate-note/);
assert.match(script, /renderAttendanceTable/);
assert.match(script, /maybeCount \* 0\.5/);
assert.match(script, /is-best-candidate/);
assert.match(script, /downloadCsv/);
assert.match(script, /reorderParticipants/);
assert.match(script, /adminDeleteParticipant/);
assert.match(manage, /updateEventSettings/);
assert.match(manage, /setConfirmedDate/);
assert.match(manage, /adminDeleteEvent/);
assert.match(style, /\.attendance-table/);
assert.match(style, /tr\.is-best-candidate/);
assert.match(style, /position: sticky/);

[
  /create or replace function public\.update_event_settings/,
  /create or replace function public\.admin_set_confirmed_date/,
  /create or replace function public\.admin_reorder_participants/,
  /create or replace function public\.admin_delete_participant/,
  /create or replace function public\.admin_delete_event/,
  /'score', totals\.yes_count \+ \(totals\.maybe_count \* 0\.5\)/,
].forEach((pattern) => assert.match(migration, pattern));

console.log("Phase 8 attendance sheet checks passed.");
