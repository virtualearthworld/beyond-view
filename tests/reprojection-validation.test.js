import test from "node:test";
import assert from "node:assert/strict";
import { compareReprojectionCandidates } from "../reconstruction/reprojection-validation.js";

const projection=(tx=0)=>[
  100,0,50,100*tx,
  0,100,50,0,
  0,0,1,0
];

test("reports lower reprojection error for the candidate matching measured observations",()=>{
  const observations=[
    {cameraIndex:0,point3D:[0,0,5],imagePoint:[52,50]},
    {cameraIndex:0,point3D:[1,0,5],imagePoint:[72,50]},
    {cameraIndex:0,point3D:[0,1,5],imagePoint:[52,70]}
  ];
  const result=compareReprojectionCandidates([projection(0)],[projection(0.1)],observations);
  assert.equal(result.status,"reprojection-comparison-complete");
  assert.ok(result.optimized.rmsErrorPixels < result.raw.rmsErrorPixels);
  assert.equal(result.raw.observationCount,3);
  assert.equal(result.optimized.observationCount,3);
  assert.ok(result.rmsImprovementPixels>0);
});

test("does not count points behind the camera as valid projections",()=>{
  const result=compareReprojectionCandidates([projection()],[projection()],[
    {cameraIndex:0,point3D:[0,0,-2],imagePoint:[50,50]}
  ]);
  assert.equal(result.status,"insufficient-valid-observations");
  assert.equal(result.raw.rejectedObservationCount,1);
  assert.equal(result.optimized.rejectedObservationCount,1);
});

test("rejects mismatched projection sets and malformed observations safely",()=>{
  assert.throws(()=>compareReprojectionCandidates([],[],[]),TypeError);
  const result=compareReprojectionCandidates([projection()],[projection()],[
    {cameraIndex:4,point3D:[0,0,5],imagePoint:[50,50]}
  ]);
  assert.equal(result.raw.observationCount,0);
  assert.equal(result.optimized.observationCount,0);
});

test("reports equal candidate quality without claiming improvement",()=>{
  const observations=[{cameraIndex:0,point3D:[0,0,5],imagePoint:[50,50]}];
  const result=compareReprojectionCandidates([projection()],[projection()],observations);
  assert.equal(result.rmsImprovementPixels,0);
  assert.match(result.interpretation,/equal RMS/);
});
