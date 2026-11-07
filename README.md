# Beyond View

**Don't just watch the world. Enter it.**

Beyond View is an early browser prototype for a social platform where people can watch a creator's video and, when a compatible reconstructed scene is available, enter that environment in 3D.

## Browser video-to-3D engine

The main workspace now hands the selected local video to the in-repository [reconstruction engine](./immersive-engine/index.html) in a separate tab using the engine's supported `?video=` import URL. The source tab must remain open until the engine imports the file. The handoff uses a browser-local Blob URL; the video is not uploaded to a Beyond View server. The engine is built from the open-source Gausify Orbit browser application and includes frame preparation, camera-pose estimation (AKAZE or COLMAP), sparse reconstruction, Gaussian-splat training, and a 3D viewer. Processing requires a compatible modern browser and may require WebGPU; actual performance and success depend on the device and source footage. The resulting Gaussian-splat scene is immersive, but is not automatically a collision-aware, unrestricted walkable world.

## First-party reconstruction lab (development diagnostics)

Open the browser-based [Reconstruction Lab](./reconstruction-lab.html) from the main workspace. It uses code maintained in this repository to sample frames locally, detect image corners, track image patches between views, estimate a dominant 2D translation, fit a robust perspective homography with RANSAC, reject inconsistent image tracks, link short feature trajectories across three frames, and report perspective-fit error and spatial coverage. Automated tests cover synthetic triangulation, known feature motion, robust translation, perspective mapping with outliers, homography quality metrics, degenerate observations, and multi-frame trajectory linking. The selected video is not uploaded by this diagnostic page. Automated Node.js regression tests cover synthetic triangulation, feature tracking under known motion, and rejection of inconsistent motion tracks; GitHub Actions runs these tests on relevant changes.

The first-party lab remains a separate measurement and validation tool. Its relative camera trajectory and sparse point cloud are provisional diagnostics, not the same reconstruction output as the Gaussian-splat engine. It does **not** yet produce a complete mesh or enable walking in a reconstructed scene. No unseen scenery should be fabricated.

## Current prototype

- `index.html`: responsive main workspace with local video preview and direct local-file handoff to the reconstruction engine.
- Video preview and engine handoff run in the browser; selecting a file does **not** upload it to a Beyond View server.
- **ENTER 3D** opens an interactive sample Gaussian Splatting environment using Three.js and Spark.
- The sample scene is loaded from Spark's hosted demo asset endpoint; it is **not generated from the selected video**.
- The viewer supports drag-to-look controls and scroll/pinch zoom. The live page still needs hands-on testing across desktop and mobile browsers.
- Accounts, online uploads, social features, and durable hosted scene storage are not implemented. The browser engine can attempt video-to-3D processing locally, but the result is not yet connected to a hosted creator feed or persistent scene library.

## Development principles

1. Keep this repository separate from the Virtual Earth project.
2. Build and verify one small stage at a time.
3. Prefer free and open-source tools while this is a zero-budget prototype.
4. Do not claim reconstruction or free-walk functionality works until it has been tested.
5. Reuse a saved reconstructed scene for viewers; do not make viewers run the original reconstruction themselves.

## Current technical components

- The in-repository `immersive-engine/` is built from the open-source [Gausify Orbit](https://github.com/obraia/gausify-orbit) browser application.
- Its browser pipeline includes AKAZE or COLMAP camera estimation, bundle adjustment, Gaussian-splat training and a scene viewer.
- WebAssembly and WebGPU assets are packaged with the built engine; model downloads and device capabilities can affect the first run.
- The first-party `reconstruction/` modules are a separate experimental geometry-validation pipeline. Their sparse PLY output is not yet imported into the Gaussian-splat engine.

## Planned milestones

1. Verify the browser interface and local video playback.
2. Publish the static prototype using GitHub Pages.
3. Connect the selected local video to the browser reconstruction engine. **The direct handoff is now implemented; live browser verification remains.**
4. Run a real capture through camera estimation and Gaussian-splat training; record device, runtime and reconstruction quality.
5. Connect completed scene packages to their source videos and add durable scene storage.
6. Add a viewer/feed experience, with movement limited to geometry actually supported by the reconstruction.

## Technical reality

A static site can host the interface and display a previously reconstructed scene, but it cannot by itself provide secure accounts, large video uploads, durable scene storage, or reliable GPU-based reconstruction. Those features will need backend services and may eventually incur costs. Free tiers and compute availability must be checked before relying on them.

An interactive Gaussian Splatting viewer is not the same as a fully navigable, collision-aware 3D world. Free walking must be limited to areas supported by the underlying reconstruction; it must not invent geometry for uncaptured areas.

## Run locally

Open `index.html` in a modern browser served from a local web server. Internet access is required for the CDN modules and demo 3D asset. Use **Choose a video** to preview a video file stored on your device, then choose **Open video-to-3D engine**. The engine opens in a new tab and imports the selected file from the original tab's local Blob URL; keep the original tab open until import finishes. The file is not uploaded to a Beyond View server.

## Status

This is a prototype, not a production-ready social network. The next check is to open the updated GitHub Pages site and test **ENTER 3D**. A successful code deployment does not by itself prove the viewer loads correctly on every device.
