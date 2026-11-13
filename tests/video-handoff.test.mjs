import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const lab = await readFile(new URL("../reconstruction-lab.html", import.meta.url), "utf8");
assert.match(html, /href="\.\/reconstruction-lab\.html"/);
assert.match(lab, /<input id="video-file" type="file"/);
assert.match(lab, /<button id="run" type="button" disabled>Analyze video<\/button>/);
assert.match(lab, /picker\.addEventListener\("change"/);
assert.match(lab, /video\.src=objectUrl/);
assert.match(lab, /run\.disabled=false/);
assert.ok(lab.indexOf('picker.addEventListener("change"') < lab.indexOf('<script type="module">'),
 "file picker must be connected before reconstruction-module imports run");
assert.match(lab, /run\.addEventListener\("click",async\(\)=>/);
assert.match(lab, /await waitForVideoReady\(\)/);
assert.doesNotMatch(lab, /run\.click\(\)/);
console.log("upload bridge and manual analysis workflow tests passed");
