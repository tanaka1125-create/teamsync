const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const eventHtml = fs.readFileSync(path.join(projectRoot, "event.html"), "utf8");
const eventScript = fs.readFileSync(
  path.join(projectRoot, "js", "event.js"),
  "utf8",
);
const style = fs.readFileSync(
  path.join(projectRoot, "css", "style.css"),
  "utf8",
);

[
  'id="event-results-title"',
  'id="results-participant-count"',
  'id="refresh-results-button"',
  'id="candidate-summary-list"',
  'id="results-table-head"',
  'id="results-table-body"',
  'id="results-action-notice"',
  'id="response-page-link"',
  'href="css/style.css?v=14"',
  'src="js/event.js?v=13"',
].forEach((requiredMarkup) => assert.ok(eventHtml.includes(requiredMarkup)));

assert.equal(eventHtml.includes('id="response-form"'), false);
assert.equal(eventHtml.includes('id="results-table-foot"'), false);
assert.equal(eventScript.includes('textContent = "集計"'), false);
assert.equal(eventScript.includes("results-total-cell"), false);
assert.equal(style.includes(".results-table tfoot"), false);

assert.match(eventScript, /TeamSyncApi\.getEventResults\(currentEventId\)/);
assert.match(eventScript, /renderCandidateSummaries\(results\)/);
assert.match(eventScript, /renderResultsTable\(results\)/);
assert.match(eventScript, /editLink\.className = "result-participant-link"/);
assert.match(eventScript, /getResponsePageUrl\(currentEventId, participant\.id\)/);
assert.match(eventScript, /deleteButton\.className = "result-delete-button"/);
assert.match(eventScript, /window\.TeamSyncApi\.deleteParticipant/);
assert.match(eventScript, /deleteButton\.dataset\.confirmDelete/);
assert.match(eventScript, /もう一度押す/);
assert.match(eventScript, /unansweredCount/);
assert.match(eventScript, /await loadResults\(\)/);
assert.match(style, /\.candidate-summary-list/);
assert.match(style, /\.results-table-scroll/);
assert.match(style, /\.result-participant-link/);
assert.match(style, /\.result-delete-button/);
assert.match(style, /font-size: 0\.86rem/);
assert.match(style, /font-size: 0\.8rem/);
assert.match(
  style,
  /\.results-table thead th \{[\s\S]*?font-size: 1\.05rem;[\s\S]*?line-height: 1\.35;/,
);
assert.match(
  style,
  /\.results-table thead th span \{[\s\S]*?font-size: 0\.86rem;/,
);
assert.match(style, /overflow-x: auto/);

console.log("Phase 7 results page checks passed.");
