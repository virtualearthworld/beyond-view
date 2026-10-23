# Beyond View

**Don't just watch the world. Enter it.**

Beyond View is an early browser prototype for a social platform where people can watch a creator's video and, when a compatible reconstructed scene is available, enter that environment in 3D.

## Current prototype

- `index.html`: responsive landing page with local video preview.
- Video preview runs in the browser; selecting a file does **not** upload it to a server.
- **ENTER 3D** opens an interactive sample Gaussian Splatting environment using Three.js and Spark.
- The sample scene is loaded from Spark's hosted demo asset endpoint; it is **not generated from the selected video**.
- The viewer supports drag-to-look controls and scroll/pinch zoom. The live page still needs hands-on testing across desktop and mobile browsers.
- Accounts, online uploads, social features, durable scene storage, and automatic video-to-3D reconstruction are not implemented.

## Development principles

1. Keep this repository separate from the Virtual Earth project.
2. Build and verify one small stage at a time.
3. Prefer free and open-source tools while this is a zero-budget prototype.
4. Do not claim reconstruction or free-walk functionality works until it has been tested.
5. Reuse a saved reconstructed scene for viewers; do not make viewers run the original reconstruction themselves.

## Current technical components

- [Three.js](https://threejs.org/) for browser-side 3D rendering.
- [Spark](https://github.com/sparkjsdev/spark) for rendering Gaussian Splatting scenes. Spark's repository declares an MIT license; see its [license file](https://github.com/sparkjsdev/spark/blob/main/LICENSE).
- Three.js and Spark are loaded from pinned public CDN URLs in the page's import map.
- The sample `snow-street.spz` file is loaded from Spark's public demo asset host. Its production-use rights and availability must be checked before using it as a permanent product asset.

## Planned milestones

1. Verify the browser interface and local video playback.
2. Publish the static prototype using GitHub Pages.
3. Integrate and test a real sample 3D scene in the browser. **Prototype code is now committed; live desktop/mobile verification is still required.**
4. Replace the demo asset with a scene we have permission to use and add a scene selection/configuration system.
5. Investigate a creator capture guide and a realistic video-to-3D processing pipeline.
6. Connect completed scenes to videos, then expand the feed and social features.

## Technical reality

A static site can host the interface and display a previously reconstructed scene, but it cannot by itself provide secure accounts, large video uploads, durable scene storage, or reliable GPU-based reconstruction. Those features will need backend services and may eventually incur costs. Free tiers and compute availability must be checked before relying on them.

An interactive Gaussian Splatting viewer is not the same as a fully navigable, collision-aware 3D world. Free walking must be limited to areas supported by the underlying reconstruction; it must not invent geometry for uncaptured areas.

## Run locally

Open `index.html` in a modern browser served from a local web server. Internet access is required for the CDN modules and demo 3D asset. Use **Choose a video** to preview a video file stored on your device. The file remains local to that browser session.

## Status

This is a prototype, not a production-ready social network. The next check is to open the updated GitHub Pages site and test **ENTER 3D**. A successful code deployment does not by itself prove the viewer loads correctly on every device.
