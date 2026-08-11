const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const eventHtml = fs.readFileSync(path.join(projectRoot, "event.html"), "utf8");
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
  'src="js/event.js?v=7"',
].forEach((requiredMarkup) => assert.ok(eventHtml.includes(requiredMarkup)));

assert.match(eventScript, /value: "yes", symbol: "○", label: "参加"/);
assert.match(eventScript, /value: "maybe", symbol: "△", label: "未定"/);
assert.match(eventScript, /value: "no", symbol: "×", label: "不参加"/);
assert.match(eventScript, /comment\.maxLength = 200/);
assert.match(eventScript, /TeamSyncApi\.submitResponses/);
assert.match(eventScript, /responses\.length === 0/);
assert.match(schema, /create table if not exists public\.participants/);
assert.match(schema, /create table if not exists public\.responses/);

console.log("Phase 6 response page checks passed.");
