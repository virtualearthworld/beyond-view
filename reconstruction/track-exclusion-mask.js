/**
 * Component-local coarse exclusion candidates from multi-view-inconsistent tracks.
 * This is geometric-instability evidence, not semantic people/water/reflection segmentation.
 * Uncertain tracks never seed masks and disconnected camera components are not pooled.
 */
function validPoint(p,w,h){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<w&&p.y>=0&&p.y<h;}
function frameKey(c,f){return c+":"+f;}
export function buildTrackExclusionMasks(tracks,{frameWidth,frameHeight,frameCount,cellSize=24,minimumTracksPerCell=3,minimumObservations=4,minimumMedianReprojectionErrorPixels=2,minimumP95ReprojectionErrorPixels=4,dilationCells=1}={}){
 if(!Array.isArray(tracks)||!Number.isFinite(frameWidth)||frameWidth<=0||!Number.isFinite(frameHeight)||frameHeight<=0||!Number.isInteger(frameCount)||frameCount<2||!Number.isInteger(cellSize)||cellSize<4||!Number.isInteger(minimumTracksPerCell)||minimumTracksPerCell<2||!Number.isInteger(minimumObservations)||minimumObservations<2||!Number.isFinite(minimumMedianReprojectionErrorPixels)||minimumMedianReprojectionErrorPixels<0||!Number.isFinite(minimumP95ReprojectionErrorPixels)||minimumP95ReprojectionErrorPixels<0||!Number.isInteger(dilationCells)||dilationCells<0||dilationCells>4)throw new TypeError("Invalid track-exclusion mask inputs.");
 const columns=Math.ceil(frameWidth/cellSize),rows=Math.ceil(frameHeight/cellSize),byFrame=new Map();let validTrackCount=0,ignoredTrackCount=0,lowConfidenceTrackCount=0,invalidObservationCount=0,validObservationCount=0;
 for(let ti=0;ti<tracks.length;ti++){const t=tracks[ti];
  if(!t||t.consistencyStatus!=="multi-view-inconsistent"||!Number.isInteger(t.componentId)||t.componentId<0||!Number.isInteger(t.fromPairIndex)||t.fromPairIndex<0||!Array.isArray(t.observations)||t.observations.length<minimumObservations){ignoredTrackCount++;continue;}
  const med=t.consistency?.medianReprojectionErrorPixels,p95=t.consistency?.p95ReprojectionErrorPixels;
  if(!Number.isFinite(med)||!Number.isFinite(p95)||(med<minimumMedianReprojectionErrorPixels&&p95<minimumP95ReprojectionErrorPixels)){lowConfidenceTrackCount++;continue;}
  validTrackCount++;
  for(let offset=0;offset<t.observations.length;offset++){const frame=t.fromPairIndex+offset,p=t.observations[offset];
   if(frame>=frameCount||!validPoint(p,frameWidth,frameHeight)){invalidObservationCount++;continue;}
   const col=Math.min(columns-1,Math.floor(p.x/cellSize)),row=Math.min(rows-1,Math.floor(p.y/cellSize)),cell=row*columns+col,key=frameKey(t.componentId,frame);
   let record=byFrame.get(key);if(!record){record={cells:new Map()};byFrame.set(key,record);}
   let ids=record.cells.get(cell);if(!ids){ids=new Set();record.cells.set(cell,ids);}ids.add(ti);validObservationCount++;
  }
 }
 const masks=new Map();let rawClusterCellCount=0,maskedCellCount=0;
 for(const [key,record] of byFrame){const mask=new Uint8Array(columns*rows);
  for(const [cell,ids] of record.cells){if(ids.size<minimumTracksPerCell)continue;rawClusterCellCount++;const cx=cell%columns,cy=Math.floor(cell/columns);
   for(let dy=-dilationCells;dy<=dilationCells;dy++)for(let dx=-dilationCells;dx<=dilationCells;dx++){const x=cx+dx,y=cy+dy;if(x>=0&&x<columns&&y>=0&&y<rows)mask[y*columns+x]=1;}
  }
  const count=mask.reduce((sum,v)=>sum+v,0);if(count){masks.set(key,mask);maskedCellCount+=count;}
 }
 return {status:rawClusterCellCount?"clustered-geometric-instability-candidates":"no-clustered-geometric-instability-candidates",masks,frameWidth,frameHeight,frameCount,cellSize,columns,rows,inputTrackCount:tracks.length,validTrackCount,ignoredTrackCount,lowConfidenceTrackCount,validObservationCount,invalidObservationCount,rawClusterCellCount,maskedCellCount,maskedFrameCount:masks.size,thresholds:{minimumTracksPerCell,minimumObservations,minimumMedianReprojectionErrorPixels,minimumP95ReprojectionErrorPixels,dilationCells},limitation:"Red cells are coarse regions with clustered multi-view-inconsistent tracks. They may represent moving people, water/reflections, occlusion, mismatches, or camera-model errors. They are not semantic labels, do not prove a region is dynamic, and cannot guarantee that all moving content is excluded."};
}
export function filterTracksByTrackExclusionMasks(tracks,audit,{minimumMaskedObservations=2,minimumMaskedObservationRatio=0.25}={}){
 if(!Array.isArray(tracks)||!audit||!(audit.masks instanceof Map)||!Number.isInteger(audit.cellSize)||audit.cellSize<1||!Number.isInteger(audit.columns)||audit.columns<1||!Number.isInteger(audit.rows)||audit.rows<1||!Number.isFinite(audit.frameWidth)||audit.frameWidth<=0||!Number.isFinite(audit.frameHeight)||audit.frameHeight<=0||!Number.isInteger(minimumMaskedObservations)||minimumMaskedObservations<1||!Number.isFinite(minimumMaskedObservationRatio)||minimumMaskedObservationRatio<=0||minimumMaskedObservationRatio>1)throw new TypeError("Invalid track-exclusion filtering inputs.");
 const retainedTracks=[],excludedTracks=[];let maskedObservationCount=0;
 for(const t of tracks){if(!t||!Number.isInteger(t.componentId)||!Number.isInteger(t.fromPairIndex)||!Array.isArray(t.observations)){retainedTracks.push(t);continue;}
  let valid=0,masked=0;for(let offset=0;offset<t.observations.length;offset++){const p=t.observations[offset];if(!validPoint(p,audit.frameWidth,audit.frameHeight))continue;valid++;const mask=audit.masks.get(frameKey(t.componentId,t.fromPairIndex+offset));if(!mask)continue;const col=Math.min(audit.columns-1,Math.floor(p.x/audit.cellSize)),row=Math.min(audit.rows-1,Math.floor(p.y/audit.cellSize));if(mask[row*audit.columns+col])masked++;}
  const ratio=valid?masked/valid:0,overlap={maskedObservations:masked,validObservations:valid,ratio};
  if(masked>=minimumMaskedObservations&&ratio>=minimumMaskedObservationRatio){excludedTracks.push({...t,exclusionReason:"overlaps-clustered-geometric-instability-mask",exclusionOverlap:overlap});maskedObservationCount+=masked;}else retainedTracks.push(t);
 }
 return {status:excludedTracks.length?"tracks-withheld-near-clustered-instability":"no-tracks-withheld-by-clustered-instability-mask",inputTrackCount:tracks.length,retainedTracks,excludedTracks,excludedTrackCount:excludedTracks.length,maskedObservationCount,thresholds:{minimumMaskedObservations,minimumMaskedObservationRatio},limitation:"Repeated overlap with a component-local mask is required. This is not semantic segmentation and may also withhold nearby static features."};
}