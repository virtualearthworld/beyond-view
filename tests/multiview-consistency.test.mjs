import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateMultiViewTrackConsistency,
  tracksToAdjacentPairs
} from "../reconstruction/multiview-consistency.js";

const K = [[500,0,320],[0,500,240],[0,0,1]];
const poses = Array.from({length:5}, (_, frame) => ({
  frame,
  componentId:0,
  status:"estimated",
  rotation:[[1,0,0],[0,1,0],[0,0,1]],
  translation:[-0.35*frame,0,0]
}));
const trajectory = {poses};

function project(point, pose) {
  const camera = [
    point[0] + pose.translation[0],
    point[1] + pose.translation[1],
    point[2] + pose.translation[2]
  ];
  return {
    x:K[0][0]*camera[0]/camera[2]+K[0][2],
    y:K[1][1]*camera[1]/camera[2]+K[1][2]
  };
}
function makeTrack(point, {moveAtFrame = -1, moveBy = 0} = {}) {
  return {
    componentId:0,
    fromPairIndex:0,
    toPairIndex:4,
    observations:poses.map(pose => {
      const moved = pose.frame === moveAtFrame
        ? [point[0]+moveBy,point[1],point[2]] : point;
      return project(moved,pose);
    })
  };
}

test("accepts a fixed 3D landmark using leave-one-view-out reprojection", () => {
  const result = evaluateMultiViewTrackConsistency(
    [makeTrack([0.2,-0.1,5])], trajectory, K
  );
  assert.equal(result.consistentTracks.length,1);
  assert.equal(result.inconsistentTracks.length,0);
  assert.equal(result.uncertainTracks.length,0);
  assert.ok(result.consistentTracks[0].consistency.p95ReprojectionErrorPixels < 1e-5);
  assert.equal(result.consistentTracks[0].consistency.heldOutCount,5);
});

test("rejects a moving 3D point that cannot explain withheld views", () => {
  const result = evaluateMultiViewTrackConsistency(
    [makeTrack([0.2,-0.1,5],{moveAtFrame:2,moveBy:1.1})], trajectory, K
  );
  assert.equal(result.consistentTracks.length,0);
  assert.equal(result.inconsistentTracks.length,1);
  assert.ok(result.inconsistentTracks[0].consistency.p95ReprojectionErrorPixels > 4);
});

test("keeps tracks with too few observations uncertain instead of rejecting them", () => {
  const short = {...makeTrack([0.2,-0.1,5]),observations:poses.slice(0,3).map(p=>project([0.2,-0.1,5],p))};
  const result = evaluateMultiViewTrackConsistency([short],trajectory,K);
  assert.equal(result.uncertainTracks.length,1);
  assert.equal(result.uncertainTracks[0].consistencyReason,"insufficient-observations");
  assert.equal(result.inconsistentTracks.length,0);
});

test("keeps tracks with missing camera poses uncertain", () => {
  const missing = {poses:poses.filter(p=>p.frame!==2)};
  const result = evaluateMultiViewTrackConsistency([makeTrack([0.2,-0.1,5])],missing,K);
  assert.equal(result.uncertainTracks.length,1);
  assert.equal(result.uncertainTracks[0].consistencyReason,"missing-camera-pose");
});

test("does not merge linked tracks across frame-pair offsets", () => {
  const first = makeTrack([0.2,-0.1,5]);
  const second = {
    componentId:0,
    fromPairIndex:2,
    observations:[{x:1,y:2},{x:3,y:4},{x:5,y:6}]
  };
  const pairs = tracksToAdjacentPairs([first,second],6);
  assert.deepEqual(pairs.map(pair=>pair.length),[1,1,2,2,0,0]);
  assert.deepEqual(pairs[2][1],{from:{x:1,y:2},to:{x:3,y:4}});
});

test("rejects invalid options", () => {
  assert.throws(
    () => evaluateMultiViewTrackConsistency([],trajectory,K,{minimumObservations:2}),
    /Invalid multi-view track-consistency inputs/
  );
  assert.throws(() => tracksToAdjacentPairs([], -1), /adjacent-pair count/);
});
