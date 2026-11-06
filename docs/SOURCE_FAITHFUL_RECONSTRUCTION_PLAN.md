# Source-Faithful Reconstruction Plan

## Product requirement

Beyond View must reconstruct the scene from the user's original video. Do not generate, hallucinate, replace, or inpaint buildings, people, water, boats, textures, or unseen geometry with generative AI. Preserve source frames and provenance for every rendered surface or animated element.

The first deliverable is a bounded, navigable reconstruction of the portions of the scene actually supported by the footage—not an unrestricted world that invents unseen viewpoints.

## What the supplied clip supports

The supplied `IMG_1325(1).mov` is 1920x1080, approximately 29.9975 FPS, 595 frames, and 19.835 seconds.

An independent exploratory OpenCV run sampled 38 grayscale frames at 0.5-second intervals, resized to 960x540, detected ORB features, applied a 0.75 ratio test, and estimated a fundamental matrix with RANSAC (1.5 px threshold, 0.99 confidence). All 37 adjacent sampled pairs produced at least 8 RANSAC inliers; median inliers were 231.

These are correspondence/epipolar-consistency measurements only. They do **not** establish a valid camera trajectory, static-background tracks, metric depth, or a successful 3D reconstruction. In particular, the clip is a close selfie composition: two people occupy much of the foreground while the waterfront skyline and water are behind them. Moving faces, hair, clothing, boat structure, reflections, and water must not be mistaken for static world geometry.

## Recommended architecture

### 1. Preserve and index source media

- Keep the original video immutable; record dimensions, frame rate, timestamps, and a content hash.
- Decode frames at adaptive intervals, retaining original timestamps.
- Store all derived frames, masks, camera estimates, and geometry with links back to source frame IDs.
- Never silently substitute synthetic imagery.

### 2. Estimate camera motion from static background only

- Detect and track features across frames.
- Exclude likely people and other independently moving regions from camera estimation.
- Prefer distant, persistent background features (shoreline, building edges) over water, reflections, faces, and boat occupants.
- Estimate robust relative pose and a consistent camera trajectory; report when the clip lacks sufficient parallax or translation.
- Do not treat a fundamental-matrix inlier as proof that a point belongs to the static background.

### 3. Separate scene layers conservatively

Maintain at least three labels: (a) static-background candidate, (b) independently moving/foreground candidate, and (c) uncertain. Use temporal consistency and optional segmentation models only to create masks/labels; segmentation must not generate replacement pixels. Keep uncertain pixels rather than forcing a classification.

### 4. Reconstruct only supported static geometry

- Test a source-faithful image-based representation such as 3D Gaussian Splatting or photogrammetry on the masked static background.
- Compare reconstruction quality, camera-path stability, coverage, and reprojection error.
- Keep original RGB observations as the appearance source.
- Build a confidence/coverage map. Regions not observed from enough viewpoints remain unavailable or are shown only from supported viewpoints; do not fabricate hidden sides of buildings.
- Because this clip has limited duration and a selfie camera path, a full walk-around of the people or buildings may not be recoverable from this clip alone.

### 5. Preserve moving content without inventing motion

- Retain original video segments for people and water, with timestamps and source-frame references.
- First implementation: render these as source-derived animated layers attached to the estimated scene, only within the viewpoints and depth range the footage supports.
- Do not loop an arbitrary 1.2-second segment. If a seamless cycle cannot be extracted from original footage, play the original interval once or keep the element view-dependent.
- Avoid duplicating a person as a full 3D animated character unless genuine multi-view data supports that reconstruction.

### 6. Navigation and honest limits

- Allow camera movement only within the reconstructed coverage envelope.
- Use view-dependent rendering/source imagery where geometry is weak.
- Prevent users from walking through unsupported regions as if they were known.
- Clearly mark areas with insufficient source coverage.

## Milestones and acceptance criteria

1. **Dataset and camera audit** — frame index, static-region candidates, camera path, parallax and coverage report.
2. **Static-background proof** — a sparse, stable background reconstruction from the real clip; show source-frame reprojections and error.
3. **Appearance-preserving reconstruction** — evaluate a small 3DGS/photogrammetry prototype on the static background; no generated replacement pixels.
4. **Foreground preservation** — source-derived people/water layers remain visually faithful and are not fused into building geometry.
5. **Bounded navigation demo** — a user can move between viewpoints actually supported by the clip without invented hidden scenery.
6. **Multi-video expansion** — capture additional overlapping viewpoints to expand the navigable area and improve geometry.

## Immediate next engineering task

Build the camera-and-coverage audit for the supplied clip: compute static-background candidate tracks outside the foreground people/water masks, estimate the camera path, and visualize where genuine parallax and multi-view coverage exist. This audit is the gate before selecting and tuning a 3D reconstruction backend.

## Quality gates

Do not call the result a successful 3D world until:
- camera poses are stable across the clip;
- static geometry is supported by multiple source views;
- reprojection/track residuals are reported;
- moving content is excluded from static geometry;
- the output can be inspected against original source frames; and
- navigation is restricted to measured coverage.

A successful build or passing unit tests alone does not satisfy these gates.


## Latest camera-motion and coverage analysis

An independent local OpenCV diagnostic of the uploaded source clip is documented in [Camera Motion and Coverage Analysis](./CAMERA_MOTION_COVERAGE_ANALYSIS.md). It sampled 40 frames at 0.5-second intervals and evaluated 39 adjacent pairs. Median ratio-filtered matches were 310, median fundamental-matrix inliers were 210, and median 4 × 3 image-grid occupancy was 7 of 12 cells; 38 of 39 pairs had inlier observations in at least three cells.

These results justify proceeding to calibrated pose estimation and longer-lived tracks. They do not establish metric depth, a valid camera trajectory, or a navigable 3D reconstruction. The next gate is calibrated camera intrinsics, multi-frame track consistency, robust relative poses, positive-depth triangulation, and reprojection validation. Preserve ambiguous observations; do not generate unseen scenery.

## Latest camera-pose sensitivity check

An independent OpenCV test on the original clip evaluated 38 adjacent 0.5-second frame pairs at five provisional focal lengths (512, 640, 768, 896, and 1024 pixels at 640 × 360 analysis resolution). Relative-pose recovery with cheirality selection succeeded on 38/38 pairs at each assumption; median cheirality inliers ranged from 142 to 152.5. Full method and limitations are recorded in [Camera-Pose Calibration Sensitivity](./CAMERA_POSE_CALIBRATION_SENSITIVITY.md).

This is not verified calibration or a validated global camera trajectory. The focal length and principal point remain assumptions; lens distortion, rolling shutter, dynamic foreground contamination, pose drift, and unknown monocular scale remain unresolved. Next gate: obtain/calibrate intrinsics, test track subsets and pose stability, then perform global consistency optimization before fusing triangulated points.
## Latest implementation: live calibration-sensitivity sweep

The Reconstruction Lab now runs five provisional focal-length assumptions (0.8, 1.0, 1.2, 1.4, and 1.6 times analysis-image width) over the same measured adjacent-frame tracks and displays relative-pose recovery counts plus median epipolar inlier support. It does not auto-select a calibration. The helper is `reconstruction/calibration-sensitivity.js`; regression tests are in `tests/calibration-sensitivity.test.js`.

An independent OpenCV run on the uploaded original video sampled 40 frames at 0.5-second intervals and tested 39 adjacent pairs. Relative pose was recovered on 39/39 pairs at all five focal assumptions (512, 640, 768, 896, and 1024 pixels at 640 × 360); median cheirality inliers were 119, 129, 124, 132, and 127 respectively. Full details and limitations are in [Original Video Focal Sensitivity Run](./ORIGINAL_VIDEO_FOCAL_SENSITIVITY_RUN.md).

These are encouraging pairwise recoverability results, not verified calibration, accurate global camera positions, metric depth, or a navigable reconstruction. The next gate remains camera calibration/distortion, static multi-frame tracks, trajectory optimization/bundle adjustment, and validated multi-view triangulation.