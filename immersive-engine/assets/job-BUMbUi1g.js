import{_ as e,a as t,c as n,d as r,f as i,g as a,h as o,i as s,l as c,m as l,n as u,o as d,p as f,r as p,s as m,t as h,u as g}from"./main-CzG_WpYF.js";var _=6,v=40,y=4,b=.12,x=.4**6,S=.6**6,C=8,w=`
struct Cam {
  rot0: vec4f, rot1: vec4f, rot2: vec4f, trans: vec4f,
  intr: vec4f,      // fx, fy, cx, cy
  dims: vec4f,      // W, H, W/Q, H/Q
  params: vec4f,    // occlusion tolerance, near, far, has mask
  center: vec4f,    // camera centre (world)
};
@group(0) @binding(0) var<uniform> cam: Cam;
fn toCam(p: vec3f) -> vec3f {
  return vec3f(dot(cam.rot0.xyz, p), dot(cam.rot1.xyz, p), dot(cam.rot2.xyz, p)) + cam.trans.xyz;
}
struct VIn { @location(0) pos: vec3f, @location(1) normal: vec3f, @location(2) uv: vec2f, @location(3) color: vec3f };
`,T=`${w}
struct VOut { @builtin(position) clip: vec4f, @location(0) z: f32 };
@vertex fn vs(v: VIn) -> VOut {
  let c = toCam(v.pos);
  let near = cam.params.y; let far = cam.params.z;
  let px = cam.intr.x * c.x + cam.intr.z * c.z;   // pixel × z
  let py = cam.intr.y * c.y + cam.intr.w * c.z;
  var o: VOut;
  o.clip = vec4f(2.0 * px / cam.dims.x - c.z, c.z - 2.0 * py / cam.dims.y, far / (far - near) * (c.z - near), c.z);
  o.z = c.z;
  return o;
}
@fragment fn fs(i: VOut) -> @location(0) vec4f { return vec4f(i.z, 0.0, 0.0, 0.0); }
`,E=`${w}
@group(0) @binding(1) var depthTex: texture_2d<f32>;
@group(0) @binding(2) var maskTex: texture_2d<f32>;
@group(0) @binding(3) var<storage, read_write> tmp: array<f32>;
@group(0) @binding(4) var<storage, read_write> minDepth: array<f32>;
@group(0) @binding(5) var<storage, read_write> feather: array<f32>;
const R = ${_}i;
const F = ${v/y}i;
fn depthAt(x: i32, y: i32) -> f32 {
  let z = textureLoad(depthTex, vec2i(x, y), 0).r;
  return select(1e30, z, z > 0.0);
}
@compute @workgroup_size(16, 16) fn minH(@builtin(global_invocation_id) g: vec3u) {
  let w = i32(cam.dims.x); let h = i32(cam.dims.y);
  let x = i32(g.x); let y = i32(g.y);
  if (x >= w || y >= h) { return; }
  var m = 1e30;
  for (var d = -R; d <= R; d++) { m = min(m, depthAt(clamp(x + d, 0, w - 1), y)); }
  tmp[y * w + x] = m;
}
@compute @workgroup_size(16, 16) fn minV(@builtin(global_invocation_id) g: vec3u) {
  let w = i32(cam.dims.x); let h = i32(cam.dims.y);
  let x = i32(g.x); let y = i32(g.y);
  if (x >= w || y >= h) { return; }
  var m = 1e30;
  for (var d = -R; d <= R; d++) { m = min(m, tmp[clamp(y + d, 0, h - 1) * w + x]); }
  minDepth[y * w + x] = m;
}
// subject (mask on, mesh hit) at ¼ resolution
fn inside(x: i32, y: i32) -> bool {
  let w = i32(cam.dims.z); let h = i32(cam.dims.w);
  if (x < 0 || y < 0 || x >= w || y >= h) { return false; }
  let p = vec2i(x * ${y} + ${y/2}, y * ${y} + ${y/2});
  let hit = textureLoad(depthTex, p, 0).r > 0.0;
  let m = select(1.0, textureLoad(maskTex, p, 0).r, cam.params.w > 0.5);
  return hit && m > 0.5;
}
// exact distance to the outside, capped at F: horizontal then vertical pass
@compute @workgroup_size(16, 16) fn edtH(@builtin(global_invocation_id) g: vec3u) {
  let w = i32(cam.dims.z); let h = i32(cam.dims.w);
  let x = i32(g.x); let y = i32(g.y);
  if (x >= w || y >= h) { return; }
  var best = f32(F + 1);
  for (var d = -F; d <= F; d++) { if (!inside(x + d, y)) { best = min(best, abs(f32(d))); } }
  tmp[y * w + x] = best;
}
@compute @workgroup_size(16, 16) fn edtV(@builtin(global_invocation_id) g: vec3u) {
  let w = i32(cam.dims.z); let h = i32(cam.dims.w);
  let x = i32(g.x); let y = i32(g.y);
  if (x >= w || y >= h) { return; }
  var best = 1e9;
  for (var d = -F; d <= F; d++) {
    let yy = y + d;
    let gx = select(0.0, tmp[clamp(yy, 0, h - 1) * w + x], yy >= 0 && yy < h);
    best = min(best, gx * gx + f32(d * d));
  }
  feather[y * w + x] = min(sqrt(best), f32(F)) / f32(F);
}
`,D=`${w}
@group(0) @binding(1) var photo: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var<storage, read> minDepth: array<f32>;
@group(0) @binding(4) var<storage, read> feather: array<f32>;
@group(0) @binding(5) var meanTex: texture_2d<f32>;
@group(0) @binding(6) var countTex: texture_2d<f32>;
struct VOut { @builtin(position) clip: vec4f, @location(0) p: vec3f, @location(1) n: vec3f, @location(2) color: vec3f };
@vertex fn vs(v: VIn) -> VOut {
  var o: VOut;
  o.clip = vec4f(v.uv.x * 2.0 - 1.0, 1.0 - v.uv.y * 2.0, 0.5, 1.0);
  o.p = v.pos; o.n = v.normal; o.color = v.color;
  return o;
}
struct Seen { ok: bool, rgb: vec3f, raw: f32, w: f32 };
fn look(p: vec3f, n: vec3f) -> Seen {
  var s: Seen; s.ok = false;
  let c = toCam(p);
  if (c.z <= 0.0) { return s; }
  let u = cam.intr.x * c.x / c.z + cam.intr.z;
  let v = cam.intr.y * c.y / c.z + cam.intr.w;
  if (u < 0.0 || v < 0.0 || u >= cam.dims.x || v >= cam.dims.y) { return s; }
  let ix = u32(u); let iy = u32(v);
  let zmin = minDepth[iy * u32(cam.dims.x) + ix];
  if (zmin > 1e29 || c.z - zmin > cam.params.x) { return s; }
  let f = feather[min(iy / ${y}u, u32(cam.dims.w) - 1u) * u32(cam.dims.z) + min(ix / ${y}u, u32(cam.dims.z) - 1u)];
  if (f <= 0.0) { return s; }
  let cosv = dot(normalize(n), normalize(cam.center.xyz - p));
  if (cosv <= 0.0) { return s; }
  let c2 = cosv * cosv;
  s.raw = c2 * c2 * c2;
  s.w = s.raw * max(smoothstep(0.0, 1.0, f), 1e-3);
  s.rgb = textureSampleLevel(photo, samp, vec2f(u / cam.dims.x, v / cam.dims.y), 0.0).rgb;
  s.ok = true;
  return s;
}
struct Out { @location(0) acc: vec4f, @location(1) extra: vec4f };
@fragment fn first(i: VOut) -> Out {
  let s = look(i.p, i.n);
  if (!s.ok) { discard; }
  return Out(vec4f(s.rgb * s.w, s.w), vec4f(1.0, 0.0, 0.0, 0.0));
}
@fragment fn second(i: VOut) -> Out {
  let s = look(i.p, i.n);
  if (!s.ok) { discard; }
  let t = vec2i(i.clip.xy);
  let m = textureLoad(meanTex, t, 0);
  let d = abs(s.rgb - m.rgb);
  if (textureLoad(countTex, t, 0).r >= 3.0 && max(d.r, max(d.g, d.b)) > ${b}) { discard; }
  return Out(vec4f(s.rgb * s.w, s.w), vec4f(s.raw, 0.0, 0.0, 0.0));
}
@fragment fn base(i: VOut) -> @location(0) vec4f { return vec4f(i.color, 1.0); }
`,O=`
@group(0) @binding(0) var acc: texture_2d<f32>;
@group(0) @binding(1) var extra: texture_2d<f32>;
@group(0) @binding(2) var base: texture_2d<f32>;
@group(0) @binding(3) var src: texture_2d<f32>;
@group(0) @binding(4) var dst: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(5) var meanOut: texture_storage_2d<rgba16float, write>;
@compute @workgroup_size(16, 16) fn mean(@builtin(global_invocation_id) g: vec3u) {
  let t = vec2i(g.xy);
  if (any(g.xy >= textureDimensions(acc))) { return; }
  let a = textureLoad(acc, t, 0);
  textureStore(meanOut, t, vec4f(a.rgb / max(a.a, 1e-8), 1.0));
}
// alpha: 1 photo colour, 0.8 vertex colour only, 0 empty
@compute @workgroup_size(16, 16) fn compose(@builtin(global_invocation_id) g: vec3u) {
  let t = vec2i(g.xy);
  if (any(g.xy >= textureDimensions(acc))) { return; }
  let a = textureLoad(acc, t, 0);
  let raw = textureLoad(extra, t, 0).r;
  let b = textureLoad(base, t, 0);
  let k = select(0.0, smoothstep(${x}, ${S}, raw), a.a > 0.0);
  let rgb = mix(b.rgb, a.rgb / max(a.a, 1e-8), k);
  let alpha = select(select(0.0, 0.8, b.a > 0.0), 1.0, k > 0.0 && b.a > 0.0);
  textureStore(dst, t, vec4f(rgb, alpha));
}
// gutter: empty texels take the mean of their filled neighbours
@compute @workgroup_size(16, 16) fn dilate(@builtin(global_invocation_id) g: vec3u) {
  let t = vec2i(g.xy);
  let size = vec2i(textureDimensions(src));
  if (any(t >= size)) { return; }
  let c = textureLoad(src, t, 0);
  if (c.a > 0.0) { textureStore(dst, t, c); return; }
  var sum = vec3f(0.0); var n = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let q = clamp(t + vec2i(dx, dy), vec2i(0), size - 1);
      let s = textureLoad(src, q, 0);
      if (s.a > 0.0) { sum += s.rgb; n += 1.0; }
    }
  }
  textureStore(dst, t, select(vec4f(0.0), vec4f(sum / max(n, 1.0), 0.5), n > 0.0));
}
`,k={arrayStride:44,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`},{shaderLocation:2,offset:24,format:`float32x2`},{shaderLocation:3,offset:32,format:`float32x3`}]},A=class{d;size;tolerance;vertices;indices;count;camBuf;depthPipe;filter;filterLayout;texelLayout;texelPipes;basePipe;resolveLayout;resolvePipes;sampler;acc;extra;mean;count0;baseTex;bounds;frame=null;pass=0;frameTextures=[];constructor(e,t,n,r){let i=this.d=e;this.size=n,this.tolerance=r;let a=t.positions.length/3,o=new Float32Array(11*a);for(let e=0;e<a;e++)o.set(t.positions.subarray(3*e,3*e+3),11*e),o.set(t.normals.subarray(3*e,3*e+3),11*e+3),o.set(t.uvs.subarray(2*e,2*e+2),11*e+6),o.set(t.colors.subarray(3*e,3*e+3),11*e+8);this.vertices=i.createBuffer({size:o.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),i.queue.writeBuffer(this.vertices,0,o),this.indices=i.createBuffer({size:t.indices.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),i.queue.writeBuffer(this.indices,0,t.indices),this.count=t.indices.length;let s=[1/0,1/0,1/0],c=[-1/0,-1/0,-1/0];for(let e=0;e<t.positions.length;e++)s[e%3]=Math.min(s[e%3],t.positions[e]),c[e%3]=Math.max(c[e%3],t.positions[e]);this.bounds={center:s.map((e,t)=>(e+c[t])/2),radius:Math.hypot(...c.map((e,t)=>e-s[t]))/2},this.camBuf=i.createBuffer({size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.sampler=i.createSampler({magFilter:`linear`,minFilter:`linear`});let l=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,u=i.createShaderModule({code:T}),d=i.createBindGroupLayout({entries:[{binding:0,visibility:l,buffer:{}}]});this.depthPipe=i.createRenderPipeline({layout:i.createPipelineLayout({bindGroupLayouts:[d]}),vertex:{module:u,entryPoint:`vs`,buffers:[k]},fragment:{module:u,entryPoint:`fs`,targets:[{format:`r32float`}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:`depth32float`,depthWriteEnabled:!0,depthCompare:`less`}});let f=GPUShaderStage.COMPUTE;this.filterLayout=i.createBindGroupLayout({entries:[{binding:0,visibility:f,buffer:{}},{binding:1,visibility:f,texture:{sampleType:`unfilterable-float`}},{binding:2,visibility:f,texture:{sampleType:`float`}},...[3,4,5].map(e=>({binding:e,visibility:f,buffer:{type:`storage`}}))]});let p=i.createShaderModule({code:E}),m=i.createPipelineLayout({bindGroupLayouts:[this.filterLayout]});this.filter=Object.fromEntries([`minH`,`minV`,`edtH`,`edtV`].map(e=>[e,i.createComputePipeline({layout:m,compute:{module:p,entryPoint:e}})])),this.texelLayout=i.createBindGroupLayout({entries:[{binding:0,visibility:l,buffer:{}},{binding:1,visibility:l,texture:{sampleType:`float`}},{binding:2,visibility:l,sampler:{}},{binding:3,visibility:l,buffer:{type:`read-only-storage`}},{binding:4,visibility:l,buffer:{type:`read-only-storage`}},{binding:5,visibility:l,texture:{sampleType:`unfilterable-float`}},{binding:6,visibility:l,texture:{sampleType:`unfilterable-float`}}]});let h=i.createShaderModule({code:D}),g=i.createPipelineLayout({bindGroupLayouts:[this.texelLayout]}),_={color:{operation:`add`,srcFactor:`one`,dstFactor:`one`},alpha:{operation:`add`,srcFactor:`one`,dstFactor:`one`}},v={color:{operation:`max`,srcFactor:`one`,dstFactor:`one`},alpha:{operation:`max`,srcFactor:`one`,dstFactor:`one`}};this.texelPipes=[`first`,`second`].map((e,t)=>i.createRenderPipeline({layout:g,vertex:{module:h,entryPoint:`vs`,buffers:[k]},fragment:{module:h,entryPoint:e,targets:[{format:`rgba16float`,blend:_},{format:`r16float`,blend:t?v:_}]},primitive:{topology:`triangle-list`,cullMode:`none`}})),this.basePipe=i.createRenderPipeline({layout:g,vertex:{module:h,entryPoint:`vs`,buffers:[k]},fragment:{module:h,entryPoint:`base`,targets:[{format:`rgba8unorm`}]},primitive:{topology:`triangle-list`,cullMode:`none`}}),this.resolveLayout=i.createBindGroupLayout({entries:[...[0,1,2,3].map(e=>({binding:e,visibility:f,texture:{sampleType:`unfilterable-float`}})),{binding:4,visibility:f,storageTexture:{access:`write-only`,format:`rgba8unorm`}},{binding:5,visibility:f,storageTexture:{access:`write-only`,format:`rgba16float`}}]});let y=i.createShaderModule({code:O}),b=i.createPipelineLayout({bindGroupLayouts:[this.resolveLayout]});this.resolvePipes=Object.fromEntries([`mean`,`compose`,`dilate`].map(e=>[e,i.createComputePipeline({layout:b,compute:{module:y,entryPoint:e}})]));let x=GPUTextureUsage,S=(e,t)=>i.createTexture({size:[n,n],format:e,usage:t});this.acc=S(`rgba16float`,x.RENDER_ATTACHMENT|x.TEXTURE_BINDING),this.extra=S(`r16float`,x.RENDER_ATTACHMENT|x.TEXTURE_BINDING),this.count0=S(`r16float`,x.RENDER_ATTACHMENT|x.TEXTURE_BINDING),this.mean=S(`rgba16float`,x.STORAGE_BINDING|x.TEXTURE_BINDING),this.baseTex=S(`rgba8unorm`,x.RENDER_ATTACHMENT|x.TEXTURE_BINDING);let C=i.createCommandEncoder(),w=this.texelBindGroup(null,null),A=C.beginRenderPass({colorAttachments:[{view:this.baseTex.createView(),loadOp:`clear`,storeOp:`store`,clearValue:[0,0,0,0]}]});A.setPipeline(this.basePipe),A.setBindGroup(0,w),this.draw(A),A.end(),this.clearAccumulators(C,this.count0),i.queue.submit([C.finish()])}draw(e){e.setVertexBuffer(0,this.vertices),e.setIndexBuffer(this.indices,`uint32`),e.drawIndexed(this.count)}clearAccumulators(e,t){e.beginRenderPass({colorAttachments:[this.acc,t].map(e=>({view:e.createView(),loadOp:`clear`,storeOp:`store`,clearValue:[0,0,0,0]}))}).end()}texelBindGroup(e,t){let n=this.d,r=e??n.createTexture({size:[1,1],format:`rgba8unorm`,usage:GPUTextureUsage.TEXTURE_BINDING}),i=e=>e??n.createBuffer({size:16,usage:GPUBufferUsage.STORAGE});return n.createBindGroup({layout:this.texelLayout,entries:[{binding:0,resource:{buffer:this.camBuf}},{binding:1,resource:r.createView()},{binding:2,resource:this.sampler},{binding:3,resource:{buffer:i(t?.minDepth)}},{binding:4,resource:{buffer:i(t?.feather)}},{binding:5,resource:this.mean.createView()},{binding:6,resource:(t&&!this.pass?this.placeholder():this.count0).createView()}]})}placeholderTex=null;placeholder(){return this.placeholderTex??=this.d.createTexture({size:[1,1],format:`r16float`,usage:GPUTextureUsage.TEXTURE_BINDING}),this.placeholderTex}frameFor(e,t){if(this.frame&&this.frame.w===e&&this.frame.h===t)return this.frame;this.releaseFrame();let n=this.d,r=GPUTextureUsage,i=Math.ceil(e/y),a=Math.ceil(t/y),o=e=>n.createBuffer({size:4*e,usage:GPUBufferUsage.STORAGE});return this.frame={w:e,h:t,depth:n.createTexture({size:[e,t],format:`r32float`,usage:r.RENDER_ATTACHMENT|r.TEXTURE_BINDING}),zbuf:n.createTexture({size:[e,t],format:`depth32float`,usage:r.RENDER_ATTACHMENT}),tmp:o(e*t),minDepth:o(e*t),feather:o(i*a)},this.frame}releaseFrame(){if(this.frame){for(let e of[this.frame.depth,this.frame.zbuf,this.frame.tmp,this.frame.minDepth,this.frame.feather])e.destroy();this.frame=null}}startSecondPass(){let e=this.d.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(this.resolvePipes.mean),t.setBindGroup(0,this.resolveBindGroup(this.acc,this.baseTex)),t.dispatchWorkgroups(Math.ceil(this.size/16),Math.ceil(this.size/16)),t.end(),this.clearAccumulators(e,this.extra),this.d.queue.submit([e.finish()]),this.pass=1}resolveBindGroup(e,t){let n=this.d,r=t&&t.format===`rgba8unorm`&&t.usage&GPUTextureUsage.STORAGE_BINDING?t:this.scratch(0);return n.createBindGroup({layout:this.resolveLayout,entries:[{binding:0,resource:this.acc.createView()},{binding:1,resource:this.extra.createView()},{binding:2,resource:this.baseTex.createView()},{binding:3,resource:e.createView()},{binding:4,resource:r.createView()},{binding:5,resource:this.mean.createView()}]})}scratchTex=[];scratch(e){return this.scratchTex[e]||(this.scratchTex[e]=this.d.createTexture({size:[this.size,this.size],format:`rgba8unorm`,usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC})),this.scratchTex[e]}photo(e,t,n,r){let i=this.d,a=t.width,o=t.height,s=this.frameFor(a,o),c=GPUTextureUsage,l=e=>{let t=i.createTexture({size:[a,o],format:`rgba8unorm`,usage:c.TEXTURE_BINDING|c.COPY_DST|c.RENDER_ATTACHMENT});return i.queue.copyExternalImageToTexture({source:e},{texture:t},[a,o]),this.frameTextures.push(t),t},u=l(t),d=n?l(n):u,{R:f,t:p}=e,m=[0,1,2].map(e=>-(f[e]*p[0]+f[3+e]*p[1]+f[6+e]*p[2])),h=Math.hypot(...m.map((e,t)=>e-this.bounds.center[t])),g=Math.max(h-this.bounds.radius*1.1,this.bounds.radius*.001),_=h+this.bounds.radius*1.1,v=new Float32Array(32);v.set([f[0],f[1],f[2],0,f[3],f[4],f[5],0,f[6],f[7],f[8],0,p[0],p[1],p[2],0]),v.set([e.fx*r,e.fy*r,e.cx*r,e.cy*r,a,o,Math.ceil(a/y),Math.ceil(o/y)],16),v.set([this.tolerance,g,_,+!!n,...m,1],24),i.queue.writeBuffer(this.camBuf,0,v);let b=i.createCommandEncoder(),x=i.createBindGroup({layout:this.depthPipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.camBuf}}]}),S=b.beginRenderPass({colorAttachments:[{view:s.depth.createView(),loadOp:`clear`,storeOp:`store`,clearValue:[0,0,0,0]}],depthStencilAttachment:{view:s.zbuf.createView(),depthLoadOp:`clear`,depthStoreOp:`store`,depthClearValue:1}});S.setPipeline(this.depthPipe),S.setBindGroup(0,x),this.draw(S),S.end();let C=i.createBindGroup({layout:this.filterLayout,entries:[{binding:0,resource:{buffer:this.camBuf}},{binding:1,resource:s.depth.createView()},{binding:2,resource:d.createView()},{binding:3,resource:{buffer:s.tmp}},{binding:4,resource:{buffer:s.minDepth}},{binding:5,resource:{buffer:s.feather}}]});for(let e of[`minH`,`minV`,`edtH`,`edtV`]){let t=b.beginComputePass();t.setPipeline(this.filter[e]),t.setBindGroup(0,C);let[n,r]=e.startsWith(`edt`)?[Math.ceil(a/y),Math.ceil(o/y)]:[a,o];t.dispatchWorkgroups(Math.ceil(n/16),Math.ceil(r/16)),t.end()}let w=b.beginRenderPass({colorAttachments:[this.acc,this.pass?this.extra:this.count0].map(e=>({view:e.createView(),loadOp:`load`,storeOp:`store`}))});w.setPipeline(this.texelPipes[this.pass]),w.setBindGroup(0,this.texelBindGroup(u,s)),this.draw(w),w.end(),i.queue.submit([b.finish()]);for(let e of this.frameTextures.splice(0))e.destroy()}async finish(){let e=this.d,t=this.size,n=e.createCommandEncoder(),r=Math.ceil(t/16),i=n.beginComputePass();i.setPipeline(this.resolvePipes.compose),i.setBindGroup(0,this.resolveBindGroup(this.acc,this.scratch(0))),i.dispatchWorkgroups(r,r),i.end();let a=0;for(let e=0;e<C;e++)i=n.beginComputePass(),i.setPipeline(this.resolvePipes.dilate),i.setBindGroup(0,this.resolveBindGroup(this.scratch(a),this.scratch(1-a))),i.dispatchWorkgroups(r,r),i.end(),a=1-a;let o=e.createBuffer({size:t*t*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});n.copyTextureToBuffer({texture:this.scratch(a)},{buffer:o,bytesPerRow:t*4},[t,t]),e.queue.submit([n.finish()]),await o.mapAsync(GPUMapMode.READ);let s=new Uint8ClampedArray(o.getMappedRange().slice(0));o.unmap(),o.destroy();let c=0,l=0;for(let e=3;e<s.length;e+=4)s[e]===255&&c++,s[e]>=204&&l++,s[e]=255;return{rgba:s,stats:{size:t,photoCoverage:l?c/l:0}}}destroy(){this.releaseFrame();for(let e of[this.vertices,this.indices,this.camBuf,this.acc,this.extra,this.mean,this.count0,this.baseTex,...this.scratchTex,this.placeholderTex])e?.destroy()}},j=e=>e+3&-4;function M(e){let t=[],n=[],r=[],i=0,a=(e,n)=>{t.push({buffer:0,byteOffset:i,byteLength:e.byteLength,...n?{target:n}:{}}),r.push(e);let a=j(e.byteLength);return a>e.byteLength&&r.push(new Uint8Array(a-e.byteLength)),i+=a,t.length-1},o=(e,t,r,i=!1)=>{let o={bufferView:a(new Uint8Array(e.buffer,e.byteOffset,e.byteLength),34962),componentType:5126,count:e.length/t,type:r};if(i){let n=Array(t).fill(1/0),r=Array(t).fill(-1/0);for(let i=0;i<e.length;i++){let a=i%t;e[i]<n[a]&&(n[a]=e[i]),e[i]>r[a]&&(r[a]=e[i])}Object.assign(o,{min:n,max:r})}return n.push(o),n.length-1},s={POSITION:o(e.positions,3,`VEC3`,!0)};e.normals&&(s.NORMAL=o(e.normals,3,`VEC3`)),e.colors&&(s.COLOR_0=o(e.colors,3,`VEC3`)),e.uvs&&(s.TEXCOORD_0=o(e.uvs,2,`VEC2`));let c=a(new Uint8Array(e.indices.buffer,e.indices.byteOffset,e.indices.byteLength),34963);n.push({bufferView:c,componentType:5125,count:e.indices.length,type:`SCALAR`});let l={asset:{version:`2.0`,generator:`Gausify Orbit`},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:s,indices:n.length-1,material:0}]}],materials:[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.8},doubleSided:!1}],accessors:n,bufferViews:t};e.texture&&(l.images=[{bufferView:a(e.texture.bytes),mimeType:e.texture.mimeType}],l.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],l.textures=[{source:0,sampler:0}],l.materials[0].pbrMetallicRoughness.baseColorTexture={index:0}),l.buffers=[{byteLength:i}];let u=new TextEncoder().encode(JSON.stringify(l)),d=j(u.length),f=20+d+8+i,p=new Uint8Array(f),m=new DataView(p.buffer);m.setUint32(0,1179937895,!0),m.setUint32(4,2,!0),m.setUint32(8,f,!0),m.setUint32(12,d,!0),m.setUint32(16,1313821514,!0),p.set(u,20),p.fill(32,20+u.length,20+d);let h=20+d;m.setUint32(h,i,!0),m.setUint32(h+4,5130562,!0),h+=8;for(let e of r)p.set(e,h),h+=e.byteLength;return p}function N(e){return e<=.04045?e/12.92:((e+.055)/1.055)**2.4}function P(e){let t=e.map(t=>t/(Math.hypot(...e)||1)),n=Math.abs(t[0])<.9?[1,0,0]:[0,0,1],r=n[0]*t[0]+n[1]*t[1]+n[2]*t[2],i=n.map((e,n)=>e-r*t[n]),a=Math.hypot(...i),o=i.map(e=>e/a);return[o,t,[o[1]*t[2]-o[2]*t[1],o[2]*t[0]-o[0]*t[2],o[0]*t[1]-o[1]*t[0]]]}function ee(e,t,n){let r=P(t),i=e.positions,a=new Float32Array(i.length),o=new Float32Array(i.length),s=[1/0,1/0,1/0],c=[-1/0,-1/0,-1/0];for(let t=0;t<i.length;t+=3)for(let n=0;n<3;n++){let l=r[n][0]*i[t]+r[n][1]*i[t+1]+r[n][2]*i[t+2];a[t+n]=l,o[t+n]=r[n][0]*e.normals[t]+r[n][1]*e.normals[t+1]+r[n][2]*e.normals[t+2],s[n]=Math.min(s[n],l),c[n]=Math.max(c[n],l)}let l=[(s[0]+c[0])/2,s[1],(s[2]+c[2])/2];for(let e=0;e<a.length;e+=3)for(let t=0;t<3;t++)a[e+t]-=l[t];return M(n&&e.uvs?{positions:a,normals:o,uvs:e.uvs,indices:e.indices,texture:{bytes:n,mimeType:`image/jpeg`}}:{positions:a,normals:o,colors:e.colors.map(N),indices:e.indices})}var F=512,I=64,L=32768,R=(e,t,n)=>((e+L)*65536+(t+L))*65536+(n+L),te=class{index=new Map;coords=[];voxel;constructor(e){this.voxel=e}mark(e,t,n){let r=this.voxel*8,i=Math.floor(e/r),a=Math.floor(t/r),o=Math.floor(n/r);if(Math.max(Math.abs(i),Math.abs(a),Math.abs(o))>=L)return;let s=R(i,a,o);this.index.has(s)||(this.index.set(s,this.coords.length/3),this.coords.push(i,a,o))}get count(){return this.coords.length/3}markFrame(e,t,n=2){let{R:r,t:i}=e.view;for(let a=0;a<e.height;a+=n)for(let o=0;o<e.width;o+=n){let n=a*e.width+o,s=e.depth[n];if(!(s>0)||!(e.rgba[n]>>>24))continue;let c=(o+.5-e.cx)/e.fx,l=(a+.5-e.cy)/e.fy,u=1/Math.hypot(c,l,1);for(let e of[-t,0,t]){let t=s+e*u,n=c*t-i[0],a=l*t-i[1],o=t-i[2];this.mark(r[0]*n+r[3]*a+r[6]*o,r[1]*n+r[4]*a+r[7]*o,r[2]*n+r[5]*a+r[8]*o)}}}},z=`
struct Params {
  rot0: vec4f, rot1: vec4f, rot2: vec4f, trans: vec4f,
  // fx, fy, cx, cy
  intr: vec4f,
  // voxel, trunc, width, height
  grid: vec4f,
  nblocks: u32, row: u32, pad0: u32, pad1: u32,
};
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> blocks: array<i32>;
@group(0) @binding(2) var<storage, read> depth: array<f32>;
@group(0) @binding(3) var<storage, read> rgba: array<u32>;
@group(0) @binding(4) var<storage, read_write> tsdfw: array<u32>;
@group(0) @binding(5) var<storage, read_write> color: array<u32>;

@compute @workgroup_size(${I})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x + gid.y * P.row;
  if (i >= P.nblocks * ${F}u) { return; }
  let b = i / ${F}u;
  let l = i % ${F}u;
  let g = vec3f(f32(blocks[3u * b]), f32(blocks[3u * b + 1u]), f32(blocks[3u * b + 2u])) * 8.0
        + vec3f(f32(l % 8u), f32((l / 8u) % 8u), f32(l / 64u));
  let p = g * P.grid.x;                         // lattice point (world)
  let c = vec3f(dot(P.rot0.xyz, p), dot(P.rot1.xyz, p), dot(P.rot2.xyz, p)) + P.trans.xyz;
  if (c.z <= 1e-4) { return; }
  let u = P.intr.x * c.x / c.z + P.intr.z;
  let v = P.intr.y * c.y / c.z + P.intr.w;
  let w = P.grid.z; let h = P.grid.w;
  if (u < 0.0 || v < 0.0 || u >= w || v >= h) { return; }
  let px = u32(u) + u32(v) * u32(w);
  let col = rgba[px];
  let d = depth[px];
  if ((col >> 24u) == 0u || d <= 0.0) { return; }
  let sdf = d - c.z;
  let trunc = P.grid.y;
  if (sdf < -trunc) { return; }
  let ts = min(1.0, sdf / trunc);
  let old = unpack2x16float(tsdfw[i]);
  let nw = old.y + 1.0;
  tsdfw[i] = pack2x16float(vec2f((old.x * old.y + ts) / nw, min(nw, 60000.0)));
  let oc = unpack4x8unorm(color[i]);
  let nc = unpack4x8unorm(col);
  color[i] = pack4x8unorm(vec4f((oc.rgb * old.y + nc.rgb) / nw, 1.0));
}
`,ne=class{pipeline;blocks;tsdfw;color;params;nblocks;depthBuf=null;rgbaBuf=null;device;set;trunc;constructor(e,t,n){this.device=e,this.set=t,this.trunc=n,this.nblocks=t.count;let r=this.nblocks*F,i=e.limits.maxStorageBufferBindingSize;if(r*4>i)throw Error(`mesh volume too large for this GPU (${r*4/2**20|0} MB per buffer)`);let a=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST;this.blocks=e.createBuffer({size:Math.max(16,this.nblocks*12),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),e.queue.writeBuffer(this.blocks,0,new Int32Array(t.coords)),this.tsdfw=e.createBuffer({size:r*4,usage:a}),this.color=e.createBuffer({size:r*4,usage:a}),this.params=e.createBuffer({size:112,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.pipeline=e.createComputePipeline({layout:`auto`,compute:{module:e.createShaderModule({code:z}),entryPoint:`main`}})}integrate(e){let t=this.device,n=e.width*e.height;(!this.depthBuf||this.depthBuf.size<n*4)&&(this.depthBuf?.destroy(),this.rgbaBuf?.destroy(),this.depthBuf=t.createBuffer({size:n*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.rgbaBuf=t.createBuffer({size:n*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})),t.queue.writeBuffer(this.depthBuf,0,e.depth),t.queue.writeBuffer(this.rgbaBuf,0,e.rgba);let r=this.nblocks*F,i=Math.ceil(r/I),a=Math.min(i,65535),o=Math.ceil(i/a),{R:s,t:c}=e.view,l=new ArrayBuffer(112),u=new Float32Array(l,0,24);u.set([s[0],s[1],s[2],0,s[3],s[4],s[5],0,s[6],s[7],s[8],0,c[0],c[1],c[2],0]),u.set([e.fx,e.fy,e.cx,e.cy,this.set.voxel,this.trunc,e.width,e.height],16),new Uint32Array(l,96,4).set([this.nblocks,a*I,0,0]),t.queue.writeBuffer(this.params,0,l);let d=t.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[this.params,this.blocks,this.depthBuf,this.rgbaBuf,this.tsdfw,this.color].map((e,t)=>({binding:t,resource:{buffer:e}}))}),f=t.createCommandEncoder(),p=f.beginComputePass();p.setPipeline(this.pipeline),p.setBindGroup(0,d),p.dispatchWorkgroups(a,o),p.end(),t.queue.submit([f.finish()])}async read(){let e=this.device,t=this.tsdfw.size,n=async n=>{let r=e.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),i=e.createCommandEncoder();i.copyBufferToBuffer(n,0,r,0,t),e.queue.submit([i.finish()]),await r.mapAsync(GPUMapMode.READ);let a=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),a},r=await n(this.tsdfw),i=await n(this.color);return{voxel:this.set.voxel,trunc:this.trunc,blocks:new Int32Array(this.set.coords),tsdfw:r,color:i}}destroy(){for(let e of[this.blocks,this.tsdfw,this.color,this.params,this.depthBuf,this.rgbaBuf])e?.destroy()}},B=4e3,V=1920;function re(){try{let e=Number(localStorage.getItem(`gausify.meshSteps`));if(e>0)return Math.round(e)}catch{}return B}var ie={"flatten-weight":100,"normal-consistency-weight":.05,"depth-distortion-weight":0,"geom-reg-start":0,"geom-reg-every":2,"geom-reg-downscale":2,"geom-reg-crop":!0,"min-scale-factor":0},H=.25,U=1e3,ae=4096,oe=.9,W={fineTune:.55,depth:.08,fuse:.12,worker:.1},G=()=>new DOMException(`cancelled`,`AbortError`);function se(e){let t=new TextDecoder().decode(e.subarray(0,4096)),n=/Vertical axis:\s*(\S+)\s+(\S+)\s+(\S+)/.exec(t),r=n?[+n[1],+n[2],+n[3]]:null;return r&&r.every(Number.isFinite)&&Math.hypot(...r)>0?r:null}function ce(e){let t=[0,0,0];for(let n of e)for(let e=0;e<3;e++)t[e]-=n.R[3+e];return t}function le(e){let t=l(e),n=[[],[],[]];for(let e=0;e<t.count;e++)if(!(1/(1+Math.exp(-t.opacity[e]))<.5))for(let r=0;r<3;r++)n[r].push(t.pos[3*e+r]);if(n[0].length<100)throw Error(`the splat has too few opaque Gaussians to mesh`);let r=n.map(e=>(e.sort((e,t)=>e-t),e[Math.floor(e.length*.99)]-e[Math.floor(e.length*.01)]));return{voxel:Math.hypot(...r)/U,splats:t.count,shDegree:t.shDegree}}async function K(e,t,n){let r=await createImageBitmap(e,{resizeWidth:t,resizeHeight:n,resizeQuality:`high`}),i=new OffscreenCanvas(t,n).getContext(`2d`,{willReadFrequently:!0});return i.drawImage(r,0,0),r.close(),i.getImageData(0,0,t,n).data}async function q(l,_,v,y=new AbortController().signal){let b=performance.now();r();let x=t(l),S=await d(l);if(!S.finalPly)throw Error(`the project has no trained splat yet`);if(!await n(`${x.model}/images.bin`))throw Error(`the project has no camera poses`);let C=(e,t)=>{if(y.aborted)throw G();v({fraction:e,message:t})},w=s(await(await c(`${x.model}/cameras.bin`)).arrayBuffer(),await(await c(`${x.model}/images.bin`)).arrayBuffer()),T=new Uint8Array(await(await c(x.finalPly)).arrayBuffer()),{voxel:E,splats:D,shDegree:O}=le(T),k=3*E,j=se(T)??ce(w),M=!!S.masks&&await n(x.masks),N=M?x.alpha:x.dataset,P=null,F=re();if(M&&!await n(`${x.alpha}/sparse/0/images.bin`)){let t=!!S.masks?.keyColor;P=N=x.meshDataset,await h(l,{enabled:!0,forPoses:!1,method:t?`chroma`:`rmbg`,chroma:e,despill:t,despillStrength:100},e=>console.info(`[mesh] ${e}`),e=>C(0,e),{out:P,maxSide:V})}let I=`${N}/init.ply`;await f(I,T);let{device:L}=await o(),R={},z={totalSteps:F,shDegree:O,maxSplats:Math.max(2e6,D*2),maxResolution:V,exportEvery:0,evalSplitEvery:0,ssimWeight:.2},B=W.fineTune,U=B+W.depth+W.fuse;try{C(0,{key:`train.loading`}),await a(await m(N),z,M,{status:e=>C(0,e),dataset:()=>{},step:e=>C(B*e/F,{key:`mesh.fineTune`,args:{iter:e,total:F}}),eval:()=>{},snapshot:()=>{},log:e=>console.info(`[mesh] ${e}`)},y,{config:ie,finish:async e=>{let t=async(t,n)=>{let r=Math.max(8,Math.round(t.width*H)),i=Math.max(8,Math.round(t.height*H)),a=r/t.width,o=i/t.height,[s,l,d,f]=[t.fx*a,t.fy*o,t.cx*a,t.cy*o],m=await e.renderDepth(new Float32Array(p(t)),new Float32Array(u(t)),s,l,d,f,r,i);if(!m)throw Error(`Brush returned no splats to render`);let h=M?await K(await c(`${x.masks}/${t.name.replace(/\.[^.]+$/,``)}.png`),r,i):null,g=n?await K(await c(`${x.images}/${t.name}`),r,i):null,_=new Float32Array(r*i),v=new Uint32Array(r*i);for(let e=0;e<r*i;e++)m[2*e+1]>.5&&m[2*e]>0&&(!h||h[4*e]>127)&&(_[e]=m[2*e],v[e]=g?(255<<24|g[4*e+2]<<16|g[4*e+1]<<8|g[4*e])>>>0:4278190080);return{view:t,width:r,height:i,fx:s,fy:l,cx:d,cy:f,depth:_,rgba:v}},n=new te(E);for(let[e,r]of w.entries())C(B+W.depth*e/w.length,{key:`mesh.depth`,args:{i:e+1,n:w.length}}),n.markFrame(await t(r,!1),k);let r=new ne(L,n,k);try{for(let[e,n]of w.entries())C(B+W.depth+W.fuse*e/w.length,{key:`mesh.fusing`,args:{i:e+1,n:w.length}}),r.integrate(await t(n,!0));R.volume=await r.read()}finally{r.destroy()}}})}catch(e){throw e instanceof DOMException&&e.name===`QuotaExceededError`?Error(`not enough browser storage for the mesh export; free disk space or delete old projects`):i(e)}finally{await g(I),P&&await g(P)}let q=R.volume;if(!q)throw Error(`the fine-tune ended before the depth maps were made`);let J=_.texture?_.triangles>=5e4?4096:2048:0,Y=_.texture?W.worker:1-U,X=new Worker(new URL(`/beyond-view/immersive-engine/assets/mesh.worker-BTfApEMn.js`,``+import.meta.url),{type:`module`}),Z=()=>X.terminate();y.addEventListener(`abort`,Z);let Q;try{Q=await new Promise((e,t)=>{X.onmessage=n=>{let r=n.data;r.kind===`progress`?v({fraction:U+Y*r.fraction,message:r.message}):r.kind===`done`?e(r):t(Error(r.message))},X.onerror=e=>t(Error(e.message?`mesh worker: ${e.message}`:`could not load the mesh worker; reload the page`)),y.addEventListener(`abort`,()=>t(G())),X.postMessage({volume:q,options:{triangles:_.triangles,up:j,texture:J}},[q.blocks.buffer,q.tsdfw.buffer,q.color.buffer])})}finally{y.removeEventListener(`abort`,Z),X.terminate()}let{mesh:$,stats:ue}=Q,de,fe=null;if(J){let e=U+Y,t=new A(L,{...$,uvs:$.uvs},J,2*E);try{for(let n of[0,1]){n&&t.startSecondPass();for(let[r,i]of w.entries()){C(e+(1-e)*.95*(n*w.length+r)/(2*w.length),{key:`mesh.baking`,args:{i:n*w.length+r+1,n:2*w.length}});let a=Math.min(1,ae/Math.max(i.width,i.height)),o=Math.round(i.width*a),s=Math.round(i.height*a),l=async e=>createImageBitmap(await c(e),{resizeWidth:o,resizeHeight:s,resizeQuality:`high`,colorSpaceConversion:`none`}),u=await l(`${x.images}/${i.name}`),d=M?await l(`${x.masks}/${i.name.replace(/\.[^.]+$/,``)}.png`):null;t.photo(i,u,d,a),u.close(),d?.close(),r%4==3&&await L.queue.onSubmittedWorkDone()}}C(e+(1-e)*.95,{key:`mesh.writing`});let{rgba:n,stats:r}=await t.finish();fe=r;let i=new OffscreenCanvas(J,J);i.getContext(`2d`).putImageData(new ImageData(n,J,J),0,0),de=new Uint8Array(await(await i.convertToBlob({type:`image/jpeg`,quality:oe})).arrayBuffer())}finally{t.destroy()}}C(1,{key:`mesh.writing`});let pe=ee($,j,de);return{name:`mesh_${Math.round(ue.triangles/1e3)}k.glb`,bytes:pe,stats:{...ue,splats:D,seconds:(performance.now()-b)/1e3,texture:fe}}}export{q as exportMesh};