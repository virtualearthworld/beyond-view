# Beyond View

**Don't just watch the world. Enter it.**

Beyond View is an early browser-based prototype for a social platform where people can watch a creator's video and, when a compatible reconstructed scene is available, enter that environment in 3D.

## Current prototype

- `index.html`: responsive starter page with a local video preview.
- The video preview runs in your browser; selecting a file does **not** upload it to a server.
- The **ENTER 3D** button is currently a placeholder. A real 3D viewer and reconstructed scene are not connected yet.
- Accounts, online uploads, social features, and automatic reconstruction are not implemented yet.

## Development principles

1. Keep this repository separate from the Virtual Earth project.
2. Build and verify one small stage at a time.
3. Prefer free and open-source tools while the project is a zero-budget prototype.
4. Do not claim reconstruction or free-walk functionality works until it has been tested.
5. Reuse a saved reconstructed scene for viewers; do not make viewers run the original reconstruction themselves.

## Planned milestones

1. Verify the browser interface and local video playback.
2. Publish the static prototype using GitHub Pages if repository settings permit.
3. Integrate an existing sample 3D Gaussian-splat scene and test browser viewing controls.
4. Investigate a creator capture guide and a realistic video-to-3D processing pipeline.
5. Connect completed scenes to videos, then expand the feed and social features.

## Technical reality

A static site can host the first interface, but it cannot by itself provide secure accounts, large video uploads, durable scene storage, or reliable GPU-based reconstruction. Those features will need backend services and may eventually incur costs. Free tiers and compute availability must be checked before relying on them.

## Run locally

Open `index.html` in a modern browser. Use **Choose a video** to preview a video file stored on your device. The file remains local to that browser session.

## Status

This is a prototype, not a production-ready social network. The next verification target is publishing and opening the static page, followed by integrating a real sample 3D scene.
