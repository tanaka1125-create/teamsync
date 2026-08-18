const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const index = read("index.html");
const event = read("event.html");
const response = read("response.html");
const manage = read("manage.html");
const calendar = read("js/calendar.js");
const create = read("js/create-event.js");

[
  'id="response-deadline"',
  'id="responses-protected"',
  'id="bulk-start-time"',
  'id="bulk-end-time"',
  "最大30件",
  'src="js/create-event.js?v=15"',
].forEach((markup) => assert.ok(index.includes(markup)));

[
  'id="results-table-head"',
  'id="results-table-body"',
  'id="results-table-foot"',
  'id="download-csv-button"',
  'id="manage-event-link"',
  "出欠を入力する",
].forEach((markup) => assert.ok(event.includes(markup)));

[
  'id="response-form"',
  'id="participant-name"',
  'id="response-closed"',
  'src="js/event.js?v=15"',
].forEach((markup) => assert.ok(response.includes(markup)));

[
  'id="manage-form"',
  'id="manage-candidate-list"',
  'id="confirmed-date-select"',
  'id="delete-event-button"',
].forEach((markup) => assert.ok(manage.includes(markup)));

assert.match(calendar, /const MAX_CANDIDATES = 30/);
assert.match(create, /responseDeadline/);
assert.match(create, /responsesProtected/);
assert.match(create, /saveOrganizerToken/);
assert.match(create, /organizerToken/);
console.log("Phase 8 page structure checks passed.");
