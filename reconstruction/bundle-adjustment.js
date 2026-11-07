import { triangulatePoint, projectPoint } from "./multiview-geometry.js";

const finite3 = v => Array.isArray(v) && v.length===3 && v.every(Number.isFinite);
const solve3 = (A,b) => {
  const m=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<3;c++){
    let p=c; for(let r=c+1;r<3;r++) if(Math.abs(m[r][c])>Math.abs(m[p][c])) p=r;
    if(Math.abs(m[p][c])<1e-10) return null;
    [m[c],m[p]]=[m[p],m[c]];
    const d=m[c][c]; for(let j=c;j<4;j++)m[c][j]/=d;
    for(let r=0;r<3;r++) if(r!==c){const f=m[r][c];for(let j=0;j<4;j++)m[r][j]-=f*m[c][j];}
  }
  return m.map(r=>r[3]);
};
const projection=(K,R,t)=>Array.from({length:3},(_,r)=>Array.from({length:4},(_,c)=>
  K[r][0]*[...R[0],t[0]][c]+K[r][1]*[...R[1],t[1]][c]+K[r][2]*[...R[2],t[2]][c])).flat();
const residual=(P,X,obs)=>{const q=projectPoint(P,X);return q?[q[0]-obs.x,q[1]-obs.y]:null;};
const cost=(rs)=>rs.reduce((s,r)=>{const e=Math.hypot(...r);return s+(e<=3?e*e:6*e-9);},0);

const rotationStep = (R, axis, angle) => {
  const c=Math.cos(angle), sn=Math.sin(angle);
  const D=axis===0?[[1,0,0],[0,c,-sn],[0,sn,c]]
    :axis===1?[[c,0,sn],[0,1,0],[-sn,0,c]]
    :[[c,-sn,0],[sn,c,0],[0,0,1]];
  return D.map(row=>R[0].map((_,j)=>row.reduce((sum,value,k)=>sum+value*R[k][j],0)));
};
function refineRotation(initial, observations, projectAt) {
  let R=initial.map(row=>row.slice()), step=0.01;
  const objective=rotation=>observations.reduce((sum,obs)=>{
    const r=projectAt(rotation,obs);if(!r)return sum+1e6;
    const e=Math.hypot(...r);return sum+(e<=3?e*e:6*e-9);
  },0);
  let best=objective(R);
  for(let round=0;round<7;round++){
    let changed=false;
    for(let axis=0;axis<3;axis++){
      for(const direction of [-1,1]){
        const candidate=rotationStep(R,axis,direction*step);
        const value=objective(candidate);
        if(value<best-1e-10){R=candidate;best=value;changed=true;}
      }
    }
    if(!changed)step*=0.5;
    if(step<1e-5)break;
  }
  return R;
}

function refine3(initial, observations, projectAt) {
  let x=initial.slice();
  for(let it=0;it<5;it++){
    const H=Array.from({length:3},()=>[0,0,0]),g=[0,0,0];
    for(const obs of observations){
      const r=projectAt(x,obs);if(!r)continue;
      const J=[[0,0,0],[0,0,0]];
      for(let d=0;d<3;d++){
        const xp=x.slice();xp[d]+=1e-5;
        const rr=projectAt(xp,obs);if(!rr)continue;
        J[0][d]=(rr[0]-r[0])/1e-5;J[1][d]=(rr[1]-r[1])/1e-5;
      }
      const e=Math.hypot(...r),w=e<=3?1:3/Math.max(e,1e-9);
      for(let a=0;a<3;a++){g[a]+=w*(J[0][a]*r[0]+J[1][a]*r[1]);for(let b=0;b<3;b++)H[a][b]+=w*(J[0][a]*J[0][b]+J[1][a]*J[1][b]);}
    }
    for(let d=0;d<3;d++)H[d][d]+=1e-5;
    const delta=solve3(H,g.map(v=>-v));if(!delta)break;
    // Backtracking prevents a numerically unstable Gauss-Newton step from
    // increasing this variable block's robust reprojection objective.
    const objective=point=>observations.reduce((sum,obs)=>{
      const r=projectAt(point,obs);if(!r)return sum;
      const e=Math.hypot(...r);return sum+(e<=3?e*e:6*e-9);
    },0);
    const before=objective(x);let accepted=null,scale=1;
    for(let attempt=0;attempt<8;attempt++,scale*=0.5){
      const candidate=x.map((v,i)=>v+scale*delta[i]);
      if(finite3(candidate)&&objective(candidate)<=before+1e-9){accepted=candidate;break;}
    }
    if(!accepted)break;
    x=accepted;
    if(Math.hypot(...delta)*scale<1e-5)break;
  }
  return x;
}

/**
 * Experimental translation-and-landmark bundle adjustment.
 * Camera rotations and intrinsics are held fixed; the first camera translation
 * anchors the gauge. Tracks are capped and robust Huber-like weights limit
 * outlier influence. This is a small sparse block-coordinate BA, not full
 * rotation/intrinsic optimization and not metric-scale recovery.
 */
export function optimizeBundleAdjustment(tracks, trajectory, K, {
  maxTracks=300, iterations=3, minObservations=3
}={}) {
  if(!Array.isArray(tracks)||!trajectory||!Array.isArray(trajectory.poses)||
     !Array.isArray(K)||K.length!==3||!Number.isInteger(maxTracks)||maxTracks<1||
     !Number.isInteger(iterations)||iterations<1||iterations>10||
     !Number.isInteger(minObservations)||minObservations<2)
    throw new TypeError("Invalid bundle-adjustment inputs.");
  // Normalize signed zero so the anchored origin is represented consistently.
  const poses=trajectory.poses.map(p=>({...p,translation:finite3(p.translation)?p.translation.map(v=>v===0?0:v):p.translation}));
  const poseMap=()=>new Map(poses.filter(p=>p.status==="estimated"&&Number.isInteger(p.frame)&&Number.isInteger(p.componentId)&&finite3(p.translation))
    .map(p=>[p.componentId+":"+p.frame,p]));
  let map=poseMap(), landmarks=[];
  for(const track of tracks.slice(0,maxTracks)){
    if(!track||!Array.isArray(track.observations)||track.observations.length<minObservations||!Number.isInteger(track.componentId)||!Number.isInteger(track.fromPairIndex))continue;
    const views=track.observations.map((o,i)=>({o,p:map.get(track.componentId+":"+(track.fromPairIndex+i))}));
    if(views.some(v=>!v.p||!finite3(v.p.translation)))continue;
    const a=views[0],b=views[views.length-1];
    const P1=projection(K,a.p.rotation,a.p.translation),P2=projection(K,b.p.rotation,b.p.translation);
    const point=triangulatePoint(P1,P2,[a.o.x,a.o.y],[b.o.x,b.o.y]);
    if(finite3(point))landmarks.push({track,views,point});
  }
  const initialCount=landmarks.length;
  if(!initialCount)return {status:"insufficient-tracks",poses,landmarks:[],initialMedianError:null,finalMedianError:null,initialMeanError:null,finalMeanError:null,optimizedTracks:0,iterations:0,rotationsOptimized:false,scaleKnown:false};
  const errors=()=>landmarks.flatMap(l=>l.views.map(v=>{
    const p=map.get(l.track.componentId+":"+(l.track.fromPairIndex+l.views.indexOf(v)));
    const q=p&&projectPoint(projection(K,p.rotation,p.translation),l.point);
    return q?Math.hypot(q[0]-v.o.x,q[1]-v.o.y):NaN;
  })).filter(Number.isFinite).sort((a,b)=>a-b);
  const med=a=>a.length?(a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2):null;
  const initialErrors=errors();
  const initialMedianError=med(initialErrors);
  const initialMeanError=initialErrors.length?initialErrors.reduce((a,b)=>a+b,0)/initialErrors.length:null;
  for(let iter=0;iter<iterations;iter++){
    map=poseMap();
    for(const l of landmarks){
      const obs=l.views.map(v=>({x:v.o.x,y:v.o.y}));
      const mats=l.views.map(v=>{const current=map.get(l.track.componentId+":"+(l.track.fromPairIndex+l.views.indexOf(v)));return projection(K,current.rotation,current.translation);});
      l.point=refine3(l.point,obs,(X,o)=>{const index=obs.indexOf(o);const q=projectPoint(mats[index],X);return q?[q[0]-o.x,q[1]-o.y]:null;});
    }
    // Optimize each non-anchor translation from its observed landmarks.
    const components=new Map();
    for(const p of poses)if(p.status==="estimated"&&Number.isInteger(p.componentId)){if(!components.has(p.componentId))components.set(p.componentId,[]);components.get(p.componentId).push(p);}
    for(const [componentId,component] of components){
      const anchor=component.slice().sort((a,b)=>a.frame-b.frame)[0];
      for(const p of component){
        if(p===anchor)continue;
        const linked=landmarks.filter(l=>l.track.componentId===componentId&&l.views.some(v=>v.p.frame===p.frame));
        if(linked.length<6)continue;
        const obs=linked.map(l=>{const v=l.views.find(v=>v.p.frame===p.frame);return {x:v.o.x,y:v.o.y,cameraPoint:l.point,K,R:p.rotation};});
        const updated=refine3(p.translation,obs,(t,o)=>{const q=projectPoint(projection(K,o.R,t),o.cameraPoint);return q?[q[0]-o.x,q[1]-o.y]:null;});
        if(finite3(updated))p.translation=updated;
      }
      // Refine camera orientation against the same linked landmarks while
      // retaining the component anchor and the relative-scale gauge.
      for(const p of component){
        if(p===anchor)continue;
        const linked=landmarks.filter(l=>l.track.componentId===componentId&&l.views.some(v=>v.p.frame===p.frame));
        if(linked.length<6)continue;
        const obs=linked.map(l=>{const v=l.views.find(v=>v.p.frame===p.frame);return {x:v.o.x,y:v.o.y,cameraPoint:l.point};});
        const updated=refineRotation(p.rotation,obs,(R,o)=>{
          const q=projectPoint(projection(K,R,p.translation),o.cameraPoint);
          return q?[q[0]-o.x,q[1]-o.y]:null;
        });
        if(Array.isArray(updated)&&updated.length===3&&updated.every(row=>row.every(Number.isFinite)))p.rotation=updated;
      }
    }
  }
  map=poseMap();
  const finalErrors=errors();
  const finalMeanError=finalErrors.length?finalErrors.reduce((a,b)=>a+b,0)/finalErrors.length:null;
  return {status:"experimental-translation-landmark-bundle-adjustment",poses,landmarks:landmarks.map(l=>({componentId:l.track.componentId,fromPairIndex:l.track.fromPairIndex,position:l.point,observations:l.views.length})),
    initialMedianError,finalMedianError:med(finalErrors),initialMeanError,finalMeanError,optimizedTracks:landmarks.length,iterations,
    rotationOptimization:true, rotationMethod:"robust-coordinate-search", intrinsicsOptimized:false,scaleKnown:false,
    limitation:"Experimental block-coordinate bundle adjustment: camera translations and rotations are refined while intrinsics remain fixed; first pose per component is anchored and monocular scale remains arbitrary. Residuals use the same observations used for fitting; validate on held-out observations before claiming accuracy."};
}
