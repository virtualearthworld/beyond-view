import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../reconstruction-lab.html", import.meta.url), "utf8");
assert.match(html, /Multi-frame consistency check/);
assert.match(html, /intervalSeconds:1\.5,maxFrames:16,width:480/);
assert.match(html, /for\(let i=0;i<sampled\.length-1;i\+\+\)/);
assert.match(html, /pairReports\.map\(p=>/);
assert.match(html, /trajectory or 3D reconstruction/);
assert.match(html, /featureSets\[0\]\.length/);
assert.match(html, /estimateCameraTrajectory/);
assert.match(html, /id="focal-length"/);
assert.match(html, /pose-segments/);
assert.match(html, /assumption, not verified camera calibration/);
assert.doesNotMatch(html, /textContent=String\(features\.length\)/);
console.log("reconstruction lab multi-frame report integration test passed");
