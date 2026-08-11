const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const eventHtml = fs.readFileSync(path.join(projectRoot, "event.html"), "utf8");
const eventScript = fs.readFileSync(
  path.join(projectRoot, "js", "event.js"),
  "utf8",
);
const createScript = fs.readFileSync(
  path.join(projectRoot, "js", "create-event.js"),
  "utf8",
);

[
  'id="event-loading"',
  'id="event-error"',
  'id="event-content"',
  'id="event-title"',
  'id="event-description"',
  'id="event-date-list"',
  'id="copy-url-button"',
  'src="js/supabase.js?v=7"',
].forEach((requiredMarkup) => assert.ok(eventHtml.includes(requiredMarkup)));

const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
[
  "SCHEDULE TOGETHER",
  "みんなの予定を、ひとつに。",
  "候補日時を選んで共有するだけ。",
].forEach((removedText) => assert.equal(indexHtml.includes(removedText), false));

assert.match(eventScript, /URLSearchParams\(window\.location\.search\)/);
assert.match(eventScript, /TeamSyncApi\.getEvent\(eventId\)/);
assert.match(eventScript, /navigator\.clipboard/);
assert.match(createScript, /eventUrl\.searchParams\.set\("id", eventId\)/);
assert.match(createScript, /window\.location\.assign\(eventUrl\.href\)/);

console.log("Phase 5 page checks passed.");
