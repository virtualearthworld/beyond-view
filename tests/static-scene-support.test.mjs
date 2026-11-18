import test from "node:test";
import assert from "node:assert/strict";
import { assessStaticSceneTrackSupport } from "../reconstruction/static-scene-support.js";

const width = 400, height = 300;
function distributedTracks(componentId = 0, {
  countPerCell = 4,
  startFrame = 0,
  observationCount = 8,
  columns = [0, 1, 2],
  rows = [0, 1]
} = {}) {
  const tracks = [];
  for (const row of rows) for (const column of columns) {
    for (let index = 0; index < countPerCell; index++) {
      const x = (column + 0.5) * width / 4 + index * 1.5;
      const y = (row + 0.5) * height / 3 + index * 1.5;
      tracks.push({
        componentId,
        fromPairIndex: startFrame,
        observations: Array.from({ length: observationCount }, (_, frame) => ({
          x: x + frame * 0.1,
          y: y + frame * 0.1
        }))
      });
    }
  }
  return tracks;
}

test("accepts a component with distributed spatial and temporal track evidence", () => {
  const tracks = distributedTracks();
  const result = assessStaticSceneTrackSupport(tracks, {
    frameWidth: width, frameHeight: height, frameCount: 8
  });
  assert.equal(result.status, "distributed-track-support-passed");
  assert.deepEqual(result.supportedComponentIds, [0]);
  assert.equal(result.supportedTrackCount, 24);
  assert.equal(result.componentReports[0].occupiedCells, 6);
  assert.equal(result.componentReports[0].occupiedColumns, 3);
  assert.equal(result.componentReports[0].occupiedRows, 2);
  assert.equal(result.componentReports[0].coveredFrameRatio, 1);
});

test("withholds a large but spatially localized foreground cluster", () => {
  const tracks = distributedTracks(0, {
    countPerCell: 24, columns: [0], rows: [1]
  });
  const result = assessStaticSceneTrackSupport(tracks, {
    frameWidth: width, frameHeight: height, frameCount: 8
  });
  assert.deepEqual(result.supportedComponentIds, []);
  assert.ok(result.componentReports[0].failedCriteria.includes("image-cell coverage"));
  assert.ok(result.componentReports[0].failedCriteria.includes("image-column coverage"));
  assert.ok(result.componentReports[0].failedCriteria.includes("image-row coverage"));
});

test("withholds a spatially broad but temporally brief component", () => {
  const tracks = distributedTracks(0, { observationCount: 4 });
  const result = assessStaticSceneTrackSupport(tracks, {
    frameWidth: width, frameHeight: height, frameCount: 20
  });
  assert.deepEqual(result.supportedComponentIds, []);
  assert.equal(result.componentReports[0].componentFrameSpanRatio, 0.2);
  assert.ok(result.componentReports[0].failedCriteria.includes("component duration coverage"));
});

test("does not pool disconnected components to satisfy the track threshold", () => {
  const first = distributedTracks(0, { countPerCell: 2 });
  const second = distributedTracks(1, { countPerCell: 2 });
  const result = assessStaticSceneTrackSupport([...first, ...second], {
    frameWidth: width, frameHeight: height, frameCount: 8
  });
  assert.equal(result.validTrackCount, 24);
  assert.deepEqual(result.supportedComponentIds, []);
  assert.deepEqual(result.unsupportedComponentIds, [0, 1]);
  assert.ok(result.componentReports.every(report => report.trackCount === 12));
  assert.ok(result.componentReports.every(report => report.failedCriteria.includes("minimum track count")));
});

test("rejects tracks with out-of-frame observations and reports why", () => {
  const tracks = distributedTracks();
  tracks[0].observations[2].x = width;
  const result = assessStaticSceneTrackSupport(tracks, {
    frameWidth: width, frameHeight: height, frameCount: 8
  });
  assert.equal(result.invalidReasons.outOfBoundsObservation, 1);
  assert.equal(result.validTrackCount, 23);
});

test("validates dimensions, grid thresholds, and ratios", () => {
  assert.throws(() => assessStaticSceneTrackSupport([], {
    frameWidth: 0, frameHeight: height, frameCount: 8
  }), /Invalid distributed static-scene support inputs/);
  assert.throws(() => assessStaticSceneTrackSupport([], {
    frameWidth: width, frameHeight: height, frameCount: 8,
    minimumOccupiedCells: 13
  }), /Invalid distributed static-scene support inputs/);
  assert.throws(() => assessStaticSceneTrackSupport([], {
    frameWidth: width, frameHeight: height, frameCount: 8,
    minimumCoveredFrameRatio: 0
  }), /Invalid distributed static-scene support inputs/);
});
