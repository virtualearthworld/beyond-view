import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const lab = await readFile(new URL("../reconstruction-lab.html", import.meta.url), "utf8");
assert.match(html, /href="\.\/reconstruction-lab\.html"/);
assert.match(lab, /<input id="video-file" type="file"/);
assert.match(lab, /<button id="run" type="button" disabled>Analyze video<\/button>/);
assert.match(lab, /picker\.addEventListener\("change"/);
assert.match(lab, /video\.src=objectUrl/);
assert.match(lab, /window\.__beyondViewAnalysisReady=false/);
assert.match(lab, /syncAnalyzeButton/);
assert.match(lab, /window\.__beyondViewAnalysisReady=true/);
const pickerStart = lab.indexOf('picker.addEventListener("change"');
const pickerEnd = lab.indexOf("\n})();", pickerStart);
const pickerHandler = lab.slice(pickerStart, pickerEnd);
assert.match(pickerHandler, /syncAnalyzeButton\(\)/);
assert.doesNotMatch(pickerHandler, /run\.disabled=false/);
assert.doesNotMatch(lab, /run\.addEventListener\("click",\(\)=>/);
assert.ok(lab.indexOf('picker.addEventListener("change"') < lab.indexOf('<script type="module">'),
 "file picker must be connected before reconstruction-module imports run");
assert.match(lab, /run\.addEventListener\("click",async\(\)=>/);
assert.match(lab, /await waitForVideoReady\(\)/);
assert.ok(lab.indexOf("window.__beyondViewAnalysisReady=true") > lab.indexOf("optimizeBundleAdjustment"),
 "engine is marked ready only after module imports and initialization");
assert.doesNotMatch(lab, /run\.click\(\)/);

assert.equal((html.match(/type="file"/g) || []).length, 0,
  "the main workspace must not introduce a second video upload location");
assert.equal((lab.match(/type="file"/g) || []).length, 1,
  "Reconstruction Lab must keep exactly one video picker");
assert.equal((lab.match(/id="run"/g) || []).length, 1,
  "Reconstruction Lab must keep one explicit Analyze Video control");
assert.doesNotMatch(html, /URL\\.createObjectURL|postMessage/,
  "the main workspace must not hand the selected file to a second upload flow");
assert.match(lab, /video\\.videoWidth>0&&video\\.videoHeight>0&&video\\.duration>0|video\\.duration>0&&video\\.videoWidth>0&&video\\.videoHeight>0/,
  "analysis readiness must require real decoded video dimensions and duration");
assert.match(lab, /Video decoded \\(/,
  "metadata readiness should be visible without starting analysis");
assert.doesNotMatch(pickerHandler, /sampleVideoFrames|run\\.click\\(\\)|run\\.addEventListener/,
  "choosing a file must not start reconstruction");
assert.ok(lab.indexOf('run.addEventListener("click",async()=>') < lab.indexOf("sampleVideoFrames(video"),
  "frame sampling must remain inside the explicit Analyze Video click handler");
assert.doesNotMatch(lab, /FormData|XMLHttpRequest|fetch\\(/,
  "the current local-only lab must not silently upload the selected video");

console.log("single-upload, decoded-video readiness, and manual-analysis tests passed");
