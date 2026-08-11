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
  'id="results-table-foot"',
  'src="js/event.js?v=7"',
].forEach((requiredMarkup) => assert.ok(eventHtml.includes(requiredMarkup)));

assert.match(eventScript, /TeamSyncApi\.getEventResults\(currentEventId\)/);
assert.match(eventScript, /renderCandidateSummaries\(results\)/);
assert.match(eventScript, /renderResultsTable\(results\)/);
assert.match(eventScript, /unansweredCount/);
assert.match(eventScript, /await loadResults\(\)/);
assert.match(style, /\.candidate-summary-list/);
assert.match(style, /\.results-table-scroll/);
assert.match(style, /overflow-x: auto/);

console.log("Phase 7 results page checks passed.");
