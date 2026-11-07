import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.match(html, /new URL\("\.\/immersive-engine\/index\.html",window\.location\.href\)/,
  "the main workspace must launch the in-repository reconstruction engine");
assert.match(html, /engineUrl\.searchParams\.set\("video",objectUrl\)/,
  "the selected local video must be handed to the engine through its supported video URL parameter");
assert.match(html, /window\.open\(engineUrl\.href,"_blank"/,
  "the engine must open in a separate tab so the source blob URL remains alive");
assert.match(html, /Keep this tab open until the engine finishes importing/,
  "the user must be told to keep the source tab open during import");
assert.match(html, /not uploaded to a Beyond View server/,
  "the privacy statement must accurately describe the local browser handoff");
console.log("video-to-engine handoff integration tests passed");
