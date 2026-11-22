import assert from "node:assert/strict";
import { componentToAsciiPly } from "../reconstruction/point-cloud-export.js";

const ply = componentToAsciiPly({ componentId: 2, points: [
  {
    position: [1, 2, 3], support: 4, sourceViewCount: 3,
    sourceFrames: [2, 4, 6], colorObservationCount: 3,
    meanReprojectionError: 0.25, maxReprojectionError: 0.7,
    maximumTriangulationAngleDegrees: 8.5
  },
  { position: [-1, 0, 2.5], support: 1, meanReprojectionError: null }
] });
assert.ok(ply.startsWith("ply\nformat ascii 1.0\n"));
assert.match(ply, /comment coordinate_frame component_local/);
assert.match(ply, /comment navigation_enabled false/);
assert.match(ply, /property uint source_view_count/);
assert.match(ply, /property int first_source_frame/);
assert.match(ply, /property int last_source_frame/);
assert.match(ply, /property float max_reprojection_error/);
assert.match(ply, /property float maximum_triangulation_angle_degrees/);
assert.ok(ply.includes("1 2 3 4 3 2 6 3 0.250000000 0.700000000 8.50000000"));
assert.ok(ply.includes("-1 0 2.50000000 1 0 -1 -1 0 -1 -1 -1"));
assert.throws(() => componentToAsciiPly({ componentId: 0, points: [] }), /no exportable points/);
assert.throws(() => componentToAsciiPly(null), /Expected/);
console.log("point-cloud export regression tests passed");

const coloredPly = componentToAsciiPly({ componentId: 4, points: [
  {
    position:[1,2,3], support:4, sourceViewCount:3, sourceFrames:[0,1,2],
    colorObservationCount:3, meanReprojectionError:0.5,
    maxReprojectionError:0.9, maximumTriangulationAngleDegrees:11,
    rgb:[12,34,56]
  },
  {
    position:[2,3,4], support:3, sourceViewCount:1, sourceFrames:[5],
    colorObservationCount:1, meanReprojectionError:0.7, rgb:null
  }
] });
assert.ok(coloredPly.includes("property uchar color_valid\nproperty uchar red\nproperty uchar green\nproperty uchar blue"));
assert.match(coloredPly,/comment appearance original_source_frame_rgb_samples/);
assert.match(coloredPly,/comment color_valid 1 means sampled source RGB; 0 means no valid source color/);
assert.match(coloredPly,/comment colorized_points 1/);
assert.match(coloredPly,/comment uncolored_points 1/);
assert.ok(coloredPly.includes("1 2 3 4 3 0 2 3 0.500000000 0.900000000 11.0000000 1 12 34 56"));
assert.ok(coloredPly.includes("2 3 4 3 1 5 5 1 0.700000000 -1 -1 0 0 0 0"),
  "uncolored geometry uses an explicitly invalid zero placeholder, not an apparent sampled color");
console.log("source RGB PLY export tests passed");
