/**
 * Build source-frame inspection records from leave-one-view-out reprojections.
 * Each projected point was triangulated from the other observations in its track.
 * Results remain tied to the source frame and camera component; they are not
 * independent camera calibration ground truth.
 */
function percentile(values,fraction){if(!values.length)return null;const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*fraction)-1)];}
function median(values){if(!values.length)return null;const sorted=values.slice().sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
export function summarizeSourceFrameReprojection(tracks,{frameCount,frameWidth,frameHeight}={}){
 if(!Array.isArray(tracks)||!Number.isInteger(frameCount)||frameCount<1||!Number.isFinite(frameWidth)||frameWidth<=0||!Number.isFinite(frameHeight)||frameHeight<=0)throw new TypeError("Invalid source-frame reprojection inputs.");
 const frames=Array.from({length:frameCount},(_,frame)=>({frame,observations:[],medianErrorPixels:null,p95ErrorPixels:null,meanErrorPixels:null,outsideFrameProjectionCount:0,componentIds:[]}));
 let invalidTrackCount=0,invalidProjectionCount=0;const allErrors=[];
 for(const track of tracks){
  if(!track||!Number.isInteger(track.componentId)||track.componentId<0){invalidTrackCount++;continue;}
  const projections=track.consistency?.heldOutProjections;if(!Array.isArray(projections))continue;
  for(const item of projections){
   const observed=item?.observed,projected=item?.projected;
   if(!Number.isInteger(item?.frame)||item.frame<0||item.frame>=frameCount||!observed||!projected||![observed.x,observed.y,projected.x,projected.y,item.errorPixels].every(Number.isFinite)||observed.x<0||observed.x>=frameWidth||observed.y<0||observed.y>=frameHeight||item.errorPixels<0){invalidProjectionCount++;continue;}
   const componentId=Number.isInteger(item.componentId)&&item.componentId>=0?item.componentId:track.componentId;
   const record={componentId,observed:{x:observed.x,y:observed.y},projected:{x:projected.x,y:projected.y},errorPixels:item.errorPixels,projectedOutsideFrame:projected.x<0||projected.x>=frameWidth||projected.y<0||projected.y>=frameHeight};
   const frame=frames[item.frame];frame.observations.push(record);if(record.projectedOutsideFrame)frame.outsideFrameProjectionCount++;if(!frame.componentIds.includes(componentId))frame.componentIds.push(componentId);allErrors.push(item.errorPixels);
  }
 }
 for(const frame of frames){const errors=frame.observations.map(item=>item.errorPixels);frame.medianErrorPixels=median(errors);frame.p95ErrorPixels=percentile(errors,.95);frame.meanErrorPixels=errors.length?errors.reduce((sum,value)=>sum+value,0)/errors.length:null;}
 return {status:allErrors.length?"source-frame-reprojection-available":"no-source-frame-reprojections",frames,totalObservations:allErrors.length,medianErrorPixels:median(allErrors),p95ErrorPixels:percentile(allErrors,.95),invalidTrackCount,invalidProjectionCount,outsideFrameProjectionCount:frames.reduce((sum,frame)=>sum+frame.outsideFrameProjectionCount,0),limitation:"Each held-out prediction is triangulated from the other views of that track using the supplied camera poses and assumed intrinsics. This is a source-frame geometric inspection aid, not independent calibration ground truth or proof of static-scene identity."};
}
