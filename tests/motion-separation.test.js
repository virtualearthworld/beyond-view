import test from "node:test";
import assert from "node:assert/strict";
import { classifyMotionLayers } from "../reconstruction/motion-separation.js";

const identity = { H: [1,0,0, 0,1,0, 0,0,1] };

function gridTracks() {
  const tracks = [];
  for (let y=0; y<3; y++) for (let x=0; x<3; x++) for (let k=0; k<3; k++) {
    const px=x*100+10+k*5, py=y*100+10+k*5;
    tracks.push({from:{x:px,y:py},to:{x:px,y:py}});
  }
  return tracks;
}

test("classifies spatially distributed homography-consistent tracks as background", () => {
  const tracks=gridTracks();
  const result=classifyMotionLayers(tracks,identity,{width:300,height:300});
  assert.equal(result.status,"background-model-supported");
  assert.equal(result.backgroundConsistent.length,tracks.length);
  assert.equal(result.independentMotionCandidates.length,0);
});

test("retains displaced tracks as independent-motion candidates", () => {
  const tracks=gridTracks();
  for(let i=0;i<5;i++) tracks[i].to.x+=25;
  const result=classifyMotionLayers(tracks,identity,{width:300,height:300});
  assert.equal(result.status,"background-model-supported");
  assert.equal(result.independentMotionCandidates.length,5);
});

test("keeps all tracks ambiguous when background support is weak", () => {
  const tracks=gridTracks().slice(0,5);
  const result=classifyMotionLayers(tracks,identity,{width:300,height:300});
  assert.equal(result.status,"insufficient-background-model");
  assert.equal(result.ambiguous.length,5);
});

test("keeps all tracks ambiguous when no homography exists", () => {
  const tracks=gridTracks();
  const result=classifyMotionLayers(tracks,{H:null},{width:300,height:300});
  assert.equal(result.ambiguous.length,tracks.length);
});

test("rejects invalid dimensions", () => {
  assert.throws(()=>classifyMotionLayers([],identity,{width:0,height:300}),TypeError);
});

test("uses the supplied projective background transform", () => {
  const tracks=gridTracks().map(track=>({
    from:track.from,
    to:{x:track.from.x+12,y:track.from.y-7}
  }));
  const translated={H:[1,0,12, 0,1,-7, 0,0,1]};
  const result=classifyMotionLayers(tracks,translated,{width:300,height:300});
  assert.equal(result.status,"background-model-supported");
  assert.equal(result.backgroundConsistent.length,tracks.length);
  assert.equal(result.independentMotionCandidates.length,0);
});
