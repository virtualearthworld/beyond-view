import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const lab = await readFile(new URL("../reconstruction-lab.html", import.meta.url), "utf8");
assert.match(html, /new URL\("\.\/immersive-engine\/index\.html",window\.location\.href\)/,
  "the main workspace must launch the in-repository reconstruction engine");
assert.match(html, /engineUrl\.searchParams\.set\("video",objectUrl\)/,
  "the selected local video must be handed to the engine through its supported video URL parameter");
assert.match(html, /window\.open\(engineUrl\.href,"_blank"\)/,
  "the engine must open in a separate tab so the source blob URL remains alive");
assert.match(html, /engineTab\.opener=null/,
  "the new engine tab must not retain access to the source page");
assert.match(html, /Keep this tab open until the engine finishes importing/,
  "the user must be told to keep the source tab open during import");
assert.match(html, /not uploaded to a Beyond View server/,
  "the privacy statement must accurately describe the local browser handoff");
console.log("video-to-engine handoff integration tests passed");

assert.match(html, /Analyze this video in Reconstruction Lab/,
  "the main workspace must provide a direct handoff to the first-party lab");
assert.match(html, /labUrl\.searchParams\.set\("video",objectUrl\)/,
  "the exact selected local video must be passed into the lab");
assert.match(lab, /new URLSearchParams\(window\.location\.search\)\.get\("video"\)/,
  "the lab must accept the selected video URL");
assert.match(lab, /sharedVideoUrl\.startsWith\("blob:"\)/,
  "the lab must restrict automatic import to a browser-local video URL");
assert.match(lab, /run\.click\(\)/,
  "the lab must start analysis automatically after the video loads");
assert.match(html, /same original waterfront video/,
  "the homepage must explicitly preserve the user's original-video requirement");
