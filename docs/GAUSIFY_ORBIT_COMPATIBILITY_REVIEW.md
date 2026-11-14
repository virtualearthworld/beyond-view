# Gausify Orbit compatibility review

**Review date:** 2026-11-14  
**Target:** the existing `IMG_1325(1).mov` waterfront selfie clip  
**Decision:** promising reconstruction technology, but not ready to replace or silently bypass the current Reconstruction Lab.

## What the bundled engine actually provides

The separate `immersive-engine/` application is built from [obraia/gausify-orbit](https://github.com/obraia/gausify-orbit), which is MIT-licensed. Its upstream README describes a browser-local video-to-Gaussian-splat pipeline:

1. Decode a video and select sharp frames.
2. Optionally create a subject mask.
3. Estimate camera poses with either its orbit-oriented AKAZE incremental SfM or a COLMAP/SIFT global mapper.
4. Train a Gaussian splat with Brush on WebGPU.
5. Inspect the splat and export PLY/SOG; optionally export a textured GLB mesh.

The web implementation uses WebGPU, WASM, and Origin Private File System storage. Upstream documents desktop Chrome or Edge with WebGPU and the `subgroups` feature. It does not require CUDA or a reconstruction server for its normal browser pipeline. SAM 2.1 model files are downloaded on first use (documented at about 84 MB in fp16 or 165 MB in fp32). The optional RMBG-1.4 model is about 176 MB and has a non-commercial license; it must not be enabled for commercial use without checking that license.

## Why it is not a drop-in solution for this clip

The upstream project is explicitly designed around **orbit videos**. Its own SfM uses circular frame matching, closes the camera orbit, and may infer missing orbit poses. That assumption does not match a waterfront selfie/walkaround clip by default. The COLMAP estimator is a more general candidate, but upstream documentation only claims it is steadier on AI-generated orbits; arbitrary handheld waterfront footage has not been verified here.

The built-in masking pipeline is also not the required semantic separation:

- Masks use **white = subject**.
- SAM 2.1 accepts one marked subject prompt (a box and positive/negative points) and propagates it through the clip.
- Masked training isolates that selected subject on a transparent/random background.
- It does not automatically label two people, water, reflections, and static waterfront structures as separate semantic classes.

For this project, the reconstruction target is the **static waterfront geometry**. The mask required by the splat pipeline would need to keep reliable buildings/shore structures while excluding the two moving people, water, reflections, and other independently moving content. A precomputed external mask video could be attached inside the engine, but generating that mask from the same source clip is not yet integrated into Beyond View. Adding another user upload is not acceptable.

The optional GLB mesh exporter also closes unseen holes. Those filled areas cannot be presented as observed source geometry under Beyond View's no-invented-geometry rule. A splat or mesh must be inspected against source frames, and unsupported regions must remain unavailable or explicitly marked unknown.

## Safe integration requirements

1. Keep the existing single picker in `reconstruction-lab.html` and the explicit **Analyze video** action. The selected `File` may be passed to the engine only after that click; the engine's own file picker must be hidden or removed from the embedded flow.
2. Run a source-specific COLMAP pose test on the exact waterfront clip before accepting the engine's orbit-oriented SfM path.
3. Report registered cameras, gaps, track support, reprojection, parallax/depth conditioning, and calibration assumptions. A low reprojection error alone is not proof of accurate geometry.
4. Generate or obtain source-aligned masks that exclude people/water/reflections without masking away the desired static structures. Uncertain regions must be omitted, not filled by a generative model.
5. Inspect the resulting splat from measured source viewpoints and compare rendered frames with the original video. If a GLB is produced, reject or label automatically closed unseen holes.
6. Derive a camera-coverage envelope and constrain navigation to it. The upstream viewer's orbit-angle limit is not, by itself, a validated walkable coverage boundary.
7. Pin the upstream repository to a reviewed commit before rebuilding; the current `.github/workflows/build-immersive-engine.yml` checks out upstream `main`, which can change between builds.

## Current evidence and blocker

The engine is bundled in the repository but is **not connected** to the Lab's selected video. No Gausify output has been generated or inspected from `IMG_1325(1).mov`. The exact video remains in the user's Library, but the newest Library copy returned a 403 when materialized in this run. An older Library copy with the same filename was materialized, but this runtime could not open the container/Python tools to verify that copy byte-for-byte or process it. It is therefore not treated as a fresh source-video test.

The current first-party Lab remains useful for correspondence, epipolar, trajectory, triangulation, and reprojection diagnostics. Its homography residuals and epipolar inliers are not semantic people/water masks, and its sparse cloud is not a finished environment.

## Next gate

Use the exact waterfront source in the existing one-picker flow, then evaluate a COLMAP-based Gausify run only after the Lab's explicit Analyze action. Do not merge an engine bridge or advertise a 3D result until that exact run yields inspectable, source-consistent geometry and a defensible coverage boundary.
