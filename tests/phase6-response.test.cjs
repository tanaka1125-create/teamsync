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
  'maxlength="40"',
  'id="back-to-results-link"',
  'src="js/event.js?v=10"',
].forEach((requiredMarkup) => assert.ok(responseHtml.includes(requiredMarkup)));

assert.match(eventScript, /value: "yes", symbol: "○", label: "参加"/);
assert.match(eventScript, /value: "maybe", symbol: "△", label: "未定"/);
assert.match(eventScript, /value: "no", symbol: "×", label: "不参加"/);
assert.match(eventScript, /comment\.maxLength = 200/);
assert.match(eventScript, /TeamSyncApi\.submitResponses/);
assert.match(eventScript, /responses\.length === 0/);
assert.match(eventScript, /window\.location\.assign\(getCanonicalEventUrl\(currentEventId\)\)/);
assert.match(schema, /create table if not exists public\.participants/);
assert.match(schema, /create table if not exists public\.responses/);

console.log("Phase 6 response page checks passed.");
