# Camera Motion and Coverage Analysis — Original Waterfront Clip

## Purpose

This report records an independent, reproducible exploratory analysis of the user's original `IMG_1325(1).mov`. The goal is to decide whether the footage has enough visual correspondence and image coverage to justify the next calibrated multi-view reconstruction stage.

This is not a completed 3D reconstruction and is not evidence of metric depth or a navigable scene.

## Source media

- Container: MOV
- Resolution: 1920 × 1080
- Frame rate reported by OpenCV: 29.997479 FPS
- Frame count: 595
- Duration: 19.835 seconds

## Exploratory test

- Sampled 40 frames at 0.5-second intervals, from 0.0 through 19.5 seconds.
- Resized samples to 640 × 360 for this diagnostic run.
- Detected up to 2,500 ORB features per frame.
- Matched adjacent samples with Hamming KNN and a 0.75 Lowe ratio threshold.
- Estimated a fundamental matrix using RANSAC with a 1.5-pixel threshold and 0.99 confidence.
- Also estimated a homography using RANSAC with a 3-pixel threshold.
- Divided each source frame into a 4 × 3 grid and counted cells containing fundamental-matrix inlier observations.

## Results

| Measurement | Result |
|---|---:|
| Sampled frames | 40 |
| Adjacent frame pairs | 39 |
| Median detected ORB features per frame | 2,460 |
| Median ratio-filtered matches per pair | 310 |
| Median fundamental-matrix inliers per pair | 210 |
| Median homography inliers per pair | 146 |
| Median occupied grid cells (of 12) | 7 |
| Pairs with at least 8 fundamental-matrix inliers | 39 / 39 |
| Pairs with inliers in at least 3 grid cells | 38 / 39 |

## Interpretation

The clip contains substantial repeatable image texture across adjacent half-second samples. Correspondences are not confined to one tiny image region in most pairs. This is a positive signal for continuing with camera-motion and multi-view analysis.

However:

1. Fundamental-matrix inliers show epipolar consistency, not a solved camera trajectory.
2. Homography inliers can be explained by a dominant plane or approximate camera rotation; they do not prove general 3D structure.
3. Image-grid occupancy is only a coarse spatial-coverage measure. It does not identify which tracks belong to static buildings versus people, water, reflections, or other moving content.
4. No calibrated camera intrinsics, validated relative poses, positive-depth triangulation, stable multi-frame tracks, or dense surfaces were established by this experiment.
5. A single moving monocular video has unknown absolute scale. The captured viewpoints bound what can be explored without inventing unseen surfaces.

## Decision

Proceed to the next engineering gate, not to a claim of a finished world:

1. Estimate or obtain camera intrinsics for the source device and image dimensions.
2. Build longer-lived feature tracks across multiple frames.
3. Robustly estimate relative camera poses and explicitly record failed pose segments.
4. Separate static-background candidates from independent motion and parallax; preserve ambiguous tracks.
5. Triangulate only points supported by valid poses, adequate baseline, reprojection checks, and positive depth.
6. Measure scene coverage and identify unsupported regions before selecting a rendering method.

The source-faithful requirement remains absolute: do not generate, replace, or hallucinate people, buildings, water, textures, or unseen geometry. Preserve the original video and its timestamps as provenance for every reconstructed or animated element.

## Reproduction note

These numbers come from an independent local OpenCV diagnostic using the uploaded source clip. They are not results from the browser Reconstruction Lab, and they do not replace the app's own end-to-end test.
