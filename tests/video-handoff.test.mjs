import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const lab = await readFile(new URL("../reconstruction-lab.html", import.meta.url), "utf8");

assert.match(html, /href="\.\/reconstruction-lab\.html"/,
  "the main workspace must open the first-party Reconstruction Lab");
assert.match(lab, /<input id="video-file" type="file"/,
  "the lab must provide one original-video picker");
assert.match(lab, /<button id="run" type="button" disabled>Analyze video<\/button>/,
  "the Analyze video button must remain visible before and after file selection");
assert.doesNotMatch(lab.match(/<button id="run"[^>]*>/)?.[0] ?? "", /hidden/,
  "the Analyze video button must never be hidden");
assert.match(lab, /run\.disabled=false;\s*run\.textContent="Analyze video"/,
  "choosing a valid video must enable the manual Analyze video button");
assert.match(lab, /run\.addEventListener\("click",async\(\)=>/,
  "analysis must be triggered by an explicit button click");
assert.match(lab, /await waitForVideoReady\(\)/,
  "the click handler must wait for video metadata before sampling frames");
assert.doesNotMatch(lab, /run\.click\(\)/,
  "selecting a file must not auto-start analysis");
console.log("manual video selection and analysis-control tests passed");
