# Beyond View

**Don't just watch the world. Enter it.**

Beyond View is an early prototype for turning original video into a measured 3D representation that can eventually be explored within the coverage actually supported by the footage.

## Current video workflow

The main workspace has no video picker. Open the [Reconstruction Lab](./reconstruction-lab.html), choose the original video there once, and wait for the browser to decode its metadata. The **Analyze video** button becomes available only when the reconstruction modules have initialized and the selected video has a usable duration and dimensions. Selecting a file does not start analysis; the user must press **Analyze video**.

The current first-party Lab processes the selected file locally in the browser. It samples up to 32 frames at 0.75-second intervals, resized to 480 pixels wide, then measures image correspondences and camera motion. For pairs with a valid relative pose, only RANSAC epipolar inliers are passed into sparse and multi-view geometry; other tracks remain in diagnostics and are held out of that geometry stage. The Lab links those camera-model tracks across frames, evaluates provisional trajectories and reprojection, and attempts sparse triangulation and point-cloud fusion. This is geometric consistency filtering, not semantic people/water segmentation: moving content that follows the dominant epipolar model can still remain. The original video is not sent to a Beyond View server by this flow.

These are development diagnostics, not a finished source-faithful 3D environment. The sparse preview is pair-local, scale is unknown, and the fused PLY is only a provisional geometry export. The current homography-based motion-layer report is not semantic person/water segmentation: residual tracks can be parallax, occlusion, reflection, moving content, or tracking errors. The pipeline does not yet prove that moving people and water have been excluded from static geometry.

## Original waterfront test source

The target remains the previously supplied `IMG_1325(1).mov` waterfront video. Its previously recorded metadata is 1920 × 1080, approximately 29.9975 FPS, 595 frames, 19.835 seconds, and about 37.9 MB. The source is intentionally not committed to this public repository. Historical OpenCV correspondence and pairwise-pose experiments are documented in [the camera coverage report](./docs/CAMERA_MOTION_COVERAGE_ANALYSIS.md) and [the triangulation report](./docs/ORIGINAL_VIDEO_PARALLAX_TRIANGULATION_ANALYSIS.md). Those earlier experiments are not a fresh end-to-end run of the current browser Lab.

Do not replace this target with a staged single-object video or a sample scene. People, water, reflections, and other independently moving content must not be mistaken for static waterfront geometry. No unseen buildings, surfaces, or textures may be generated to fill gaps.

## Repository components and boundaries

- `index.html`: main workspace and the single link to the Reconstruction Lab.
- `reconstruction-lab.html`: the only video picker and the explicit Analyze video action.
- `reconstruction/`: first-party browser diagnostics for feature tracks, epipolar/camera-pose estimation, trajectory checks, triangulation, reprojection, point-cloud fusion, and export.
- `immersive-engine/`: a separate packaged Gausify Orbit browser application. It is not currently wired to the Lab's selected local file, and no output from it has been verified as a reconstruction of the waterfront source video. Do not present a demo scene from it as the user's result.
- `backend/`: a Cloudflare Worker prototype that stores uploaded files in R2 and reports `not_started`; it does not perform reconstruction. It is not configured in `config.js`. Its 25 MB limit is below the original waterfront video's approximately 37.9 MB size, so it cannot currently accept the target clip.

## What is still missing

1. A fresh browser end-to-end run of the exact waterfront file through the current one-picker, manual-Analyze workflow.
2. A reliable people/water/reflection segmentation or equivalent conservative masking stage, with uncertain regions preserved rather than forced into the static model.
3. A calibrated, globally consistent camera trajectory and validated multi-view tracks with reported pose gaps, depth uncertainty, triangulation angles, and held-out reprojection.
4. A recognizable, source-derived dense representation (mesh or Gaussian splats) with inspectable source-frame provenance.
5. A coverage envelope that restricts navigation to measured geometry and leaves unseen regions unavailable.
6. If local browser processing proves insufficient, an approved compute backend and storage design. The existing upload-only Worker is not that backend.

A passing unit-test suite or a successful GitHub Pages deployment is not evidence that these reconstruction milestones are complete.

## Development principles

1. Keep Beyond View separate from the Virtual Earth / virtual-art project.
2. Preserve the original source video and its provenance.
3. Prefer free and open-source methods while this remains a zero-budget prototype.
4. Never synthesize missing people, buildings, water, reflections, or hidden geometry.
5. Report uncertain geometry as uncertain; do not claim metric scale or unrestricted walking without evidence.
6. Reuse a verified reconstructed scene for viewers rather than making every viewer process the source video.

## Run locally

Serve the repository root with a local web server, open `index.html`, then open the Reconstruction Lab. Choose the original video in the Lab and press **Analyze video** after the metadata is ready. No second upload, ZIP handoff, or automatic analysis on file selection is part of the current flow.

## Current status

The one-location upload and explicit analysis gate are implemented and covered by regression tests. The latest recorded reconstruction-test and Pages workflows passed on commit `74154056f5c866c2a0928ddce00bf3a3283eaf59`. The original waterfront clip has not yet passed the current browser end-to-end acceptance gate, and Beyond View is not yet a completed video-to-3D reconstruction product.
