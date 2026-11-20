import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCalibrationSensitivity } from "../reconstruction/calibration-sensitivity.js";

test("sweeps focal assumptions without choosing a calibration", () => {
  const framePairs = [{ tracks: [] }, { tracks: [] }, { tracks: [] }];
  const calls = [];
  const results = analyzeCalibrationSensitivity(framePairs, {
    width: 640,
    height: 360,
    focalMultipliers: [0.8, 1, 1.2],
    estimateTrajectory: (_pairs, K, multiplier) => {
      calls.push({ K, multiplier });
      const count = Math.round(multiplier * 100);
      return {
        status: "partial-trajectory",
        segments: [
          { status: "estimated", diagnostics: { epipolar: { inlierCount: count } } },
          { status: "gap" },
          { status: "estimated", diagnostics: { epipolar: { inlierCount: count + 2 } } }
        ]
      };
    }
  });

  assert.equal(results.length, 3);
  assert.equal(results[0].focalLengthPixels, 512);
  assert.equal(results[1].focalLengthPixels, 640);
  assert.equal(results[2].focalLengthPixels, 768);
  assert.deepEqual(results.map(result => result.recoveredPairs), [2, 2, 2]);
  assert.deepEqual(results.map(result => result.medianEpipolarInliers), [81, 101, 121]);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1].K, [[640, 0, 320], [0, 640, 180], [0, 0, 1]]);
  assert.ok(results.every(result => result.scaleKnown === false));
});

test("rejects invalid calibration sweep inputs", () => {
  assert.throws(() => analyzeCalibrationSensitivity([], {
    width: 640, height: 360, estimateTrajectory: () => ({ segments: [] })
  }), TypeError);
});


const identityRotation = [[1,0,0],[0,1,0],[0,0,1]];
const zRotation = degrees => {
  const angle = degrees * Math.PI / 180;
  return [[Math.cos(angle),-Math.sin(angle),0],[Math.sin(angle),Math.cos(angle),0],[0,0,1]];
};
const direction = degrees => {
  const angle = degrees * Math.PI / 180;
  return [Math.cos(angle),Math.sin(angle),0];
};
const estimated = (rotation, translationDirection) => ({
  status:"estimated",
  pose:{rotation,translationDirection}
});

test("compares pairwise pose changes against the tested focal assumption nearest the entered value", () => {
  const byMultiplier = {
    0.8: {segments:[estimated(zRotation(10),direction(20)),{status:"gap"}]},
    1: {segments:[estimated(zRotation(5),direction(10)),estimated(zRotation(5),direction(10))]},
    1.2: {segments:[estimated(identityRotation,[1,0,0]),estimated(identityRotation,[1,0,0])]},
    1.4: {segments:[{status:"gap"},estimated(zRotation(15),direction(25))]}
  };
  const results = analyzeCalibrationSensitivity([{tracks:[]},{tracks:[]}], {
    width:640,
    height:360,
    focalMultipliers:[0.8,1,1.2,1.4],
    referenceFocalLengthPixels:760,
    estimateTrajectory:(_pairs,_K,multiplier)=>byMultiplier[multiplier]
  });
  const reference=results.find(result=>result.poseSensitivity.isReference);
  assert.equal(reference.multiplier,1.2,"reference must be nearest the user's entered focal length");
  assert.equal(reference.poseSensitivity.referenceMultiplier,1.2);
  assert.equal(reference.poseSensitivity.comparedPairCount,2);
  assert.equal(reference.poseSensitivity.medianRotationDeltaDegrees,0);
  const lower=results.find(result=>result.multiplier===0.8).poseSensitivity;
  assert.equal(lower.comparedPairCount,1);
  assert.equal(lower.referenceOnlyPairCount,1);
  assert.ok(Math.abs(lower.medianRotationDeltaDegrees-10)<1e-6);
  assert.ok(Math.abs(lower.p95RotationDeltaDegrees-10)<1e-6);
  assert.ok(Math.abs(lower.medianTranslationDirectionDeltaDegrees-20)<1e-6);
  const middle=results.find(result=>result.multiplier===1).poseSensitivity;
  assert.equal(middle.comparedPairCount,2);
  assert.ok(Math.abs(middle.medianRotationDeltaDegrees-5)<1e-6);
  assert.ok(Math.abs(middle.medianTranslationDirectionDeltaDegrees-10)<1e-6);
  const upper=results.find(result=>result.multiplier===1.4).poseSensitivity;
  assert.equal(upper.comparedPairCount,1);
  assert.equal(upper.candidateOnlyPairCount,0);
  assert.equal(upper.referenceOnlyPairCount,1);
});

test("reports missing pose overlap without inventing zero-delta stability", () => {
  const results=analyzeCalibrationSensitivity([{tracks:[]}],{
    width:640,height:360,focalMultipliers:[1,1.2],referenceFocalLengthPixels:640,
    estimateTrajectory:(_pairs,_K,multiplier)=>({segments:[multiplier===1?estimated(identityRotation,[1,0,0]):{status:"gap"}]})
  });
  const missing=results.find(result=>result.multiplier===1.2).poseSensitivity;
  assert.equal(missing.status,"no-common-estimated-pairs");
  assert.equal(missing.comparedPairCount,0);
  assert.equal(missing.medianRotationDeltaDegrees,null);
  assert.equal(missing.medianTranslationDirectionDeltaDegrees,null);
});

test("rejects a non-positive reference focal length", () => {
  assert.throws(()=>analyzeCalibrationSensitivity([{tracks:[]}],{
    width:640,height:360,referenceFocalLengthPixels:0,estimateTrajectory:()=>({segments:[]})
  }),/positive reference focal length/);
});
