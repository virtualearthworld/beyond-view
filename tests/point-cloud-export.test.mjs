import assert from "node:assert/strict";
import { componentToAsciiPly } from "../reconstruction/point-cloud-export.js";

const ply = componentToAsciiPly({ componentId: 2, points: [
  { position: [1, 2, 3], support: 4, meanReprojectionError: 0.25 },
  { position: [-1, 0, 2.5], support: 1, meanReprojectionError: null }
] });
assert.ok(ply.startsWith("ply\nformat ascii 1.0\n"));
assert.ok(ply.startsWith("ply\nformat ascii 1.0\n"));
assert.ok(ply.startsWith("ply\nformat ascii 1.0\n"));
assert.ok(ply.includes("1 2 3 4 0.25"));
assert.ok(ply.includes("-1 0 2.5 1 -1"));
assert.throws(() => componentToAsciiPly({ componentId: 0, points: [] }), /no exportable points/);
assert.throws(() => componentToAsciiPly(null), /Expected/);
console.log("point-cloud export regression tests passed");

const coloredPly = componentToAsciiPly({ componentId: 4, points: [
  { position:[1,2,3], support:4, meanReprojectionError:0.5, rgb:[12,34,56] },
  { position:[2,3,4], support:3, meanReprojectionError:0.7, rgb:null }
] });
assert.ok(coloredPly.includes("property uchar red\nproperty uchar green\nproperty uchar blue"));
assert.match(coloredPly,/comment appearance original_source_frame_rgb_samples/);
assert.match(coloredPly,/comment colorized_points 1/);
assert.match(coloredPly,/comment uncolored_points 1/);
assert.ok(coloredPly.includes("1 2 3 4 0.5 12 34 56"));
assert.ok(coloredPly.includes("2 3 4 3 0.7 128 128 128"),
  "uncolored validated geometry receives a neutral export placeholder, not invented source color");
console.log("source RGB PLY export tests passed");
