# Multi-view fixed-scene track consistency gate

## Purpose

The Reconstruction Lab now applies a leave-one-observation-out (LOO) geometric consistency test before a track can contribute to the second camera-pose estimate, sparse triangulation, point-cloud fusion, or PLY export.

A pairwise epipolar inlier is only a correspondence that agrees with one two-view epipolar model. It is not proof that the observed feature belongs to a static building or shoreline. A moving person or water feature can also be an epipolar inlier.

## Method

For each linked track inside one connected camera-path component:

1. Require at least four consecutive sampled-frame observations.
2. Hold out one observation.
3. Triangulate a candidate 3D landmark from all remaining observations using the current camera poses and assumed intrinsics.
4. Require positive camera-space depth in every training view and the held-out view.
5. Require at least 2 degrees of maximum triangulation angle among the training views.
6. Project the candidate landmark into the held-out camera and record its pixel error.
7. Repeat for each observation in the track.

Default acceptance thresholds:
- At least 2 usable held-out views.
- Median held-out reprojection error no greater than 2 px.
- 95th-percentile held-out reprojection error no greater than 4 px.
- Maximum held-out reprojection error no greater than 8 px.

Tracks are separated into:
- **Multi-view consistent:** passes all configured held-out reprojection thresholds.
- **Multi-view inconsistent:** enough held-out observations were measurable, but one or more error thresholds failed.
- **Uncertain:** too few observations, missing camera poses, failed triangulation, insufficient parallax, or too few usable held-out views.

Only consistent tracks are converted back into adjacent-pair correspondences. A second relative camera-pose estimate is then computed from those correspondences. The Lab repeats the consistency audit against that filtered pose path. If fewer than eight tracks survive, sparse geometry and PLY export are withheld rather than falling back to unfiltered epipolar tracks.

## What this improves

- It tests a single fixed 3D point against observations that were not used to triangulate that point.
- It reduces the chance that a transient foreground feature becomes a persistent static landmark.
- It prevents uncertain or inconsistent linked tracks from entering the sparse point cloud and its PLY export.
- It gives the Lab separate counts for consistent, inconsistent, and uncertain tracks.
- It re-estimates the relative camera path from the first-pass consistent subset before geometry is produced.

## What it does not prove

This is **not semantic segmentation** and it does not identify people, water, boats, or reflections by category. A moving feature can still pass if its motion happens to fit one fixed 3D point under the estimated camera path. Conversely, a real static building feature can fail because of calibration error, pose drift, rolling shutter, occlusion, parallax, feature mismatch, or a short baseline.

The camera poses still use assumed intrinsics and monocular unit-baseline translation. The LOO test is not independent ground truth because the camera poses were estimated from the same source clip. The output remains sparse diagnostic geometry, not a textured mesh or Gaussian-splat environment. Free navigation remains disabled.

## Verification

Synthetic regression tests cover:
- a fixed 3D landmark that passes held-out reprojection;
- a point that moves in one sampled view and is rejected as inconsistent;
- short tracks and missing camera poses remaining uncertain;
- correct conversion of linked tracks into their original adjacent-pair slots.

The GitHub Actions suite runs this test alongside the existing reconstruction suite. These tests verify the algorithm on controlled data only; they do not constitute a run of the original waterfront video.

## Next acceptance gate

Run the exact existing `IMG_1325(1).mov` through the single-upload Reconstruction Lab. Inspect the first-pass and second-pass track counts, camera-pose gaps, per-track held-out residuals, source-frame overlays, triangulation angles, and fused point-cloud provenance. Then add source-aligned person/water/reflection masks and compare the filtered camera path against independently verified calibration. Do not label geometric consistency as semantic object removal.
