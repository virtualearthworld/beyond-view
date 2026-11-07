import assert from "node:assert/strict";
import { componentToAsciiPly } from "../reconstruction/point-cloud-export.js";

const ply = componentToAsciiPly({ componentId: 2, points: [
  { position: [1, 2, 3], support: 4, meanReprojectionError: 0.25 },
  { position: [-1, 0, 2.5], support: 1, meanReprojectionError: null }
] });
assert.match(ply, /^ply\nformat ascii 1\\.0\n/);
assert.match(ply, /comment monocular_scale_unknown true/);
assert.match(ply, /element vertex 2/);
assert.match(ply, /1 2 3 4 0\\.25/);
assert.match(ply, /-1 0 2\\.5 1 -1/);
assert.throws(() => componentToAsciiPly({ componentId: 0, points: [] }), /no exportable points/);
assert.throws(() => componentToAsciiPly(null), /Expected/);
console.log("point-cloud export regression tests passed");
