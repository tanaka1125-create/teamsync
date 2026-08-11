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
  'id="response-page-link"',
  'src="js/event.js?v=11"',
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
assert.match(eventScript, /unansweredCount/);
assert.match(eventScript, /await loadResults\(\)/);
assert.match(style, /\.candidate-summary-list/);
assert.match(style, /\.results-table-scroll/);
assert.match(style, /\.result-participant-link/);
assert.match(style, /overflow-x: auto/);

console.log("Phase 7 results page checks passed.");
