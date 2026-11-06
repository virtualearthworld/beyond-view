# Multi-view reprojection integration report

## Changes
- Added `reconstruction/multiview-reprojection.js`. It triangulates each persistent image track from its first and last observations, then reprojects that landmark into every observed frame.
- The evaluator supports raw and regularized translation paths. Both runs use the same persistent tracks and assumed camera intrinsics.
- Connected the evaluator to the Reconstruction Lab and added raw/regularized median reprojection error plus evaluated/skipped landmark counts.
- Corrected the trajectory smoothness calculation: optimized second differences are now accumulated before the RMS is reported.
- Added regression coverage for multi-view reprojection, raw-translation selection, insufficient tracks, and lower optimized acceleration on a noisy test path.

## Original video inspection
The supplied `IMG_1325(1).mov` was readable in the analysis environment:
- 1920 × 1080
- approximately 29.9975 frames/second
- 595 frames
- 19.835 seconds

An independent ORB/RANSAC check on 38 frames sampled at 0.5-second intervals produced 37 adjacent pairs. Across those pairs, the median was 201 ratio-filtered descriptor matches and 140 fundamental-matrix inliers. These figures indicate trackable image content only; they do not establish accurate calibration, depth, or a walkable reconstruction.

## Interpretation and limitations
- The multi-view evaluator is now called by the browser pipeline using persistent tracks and the current assumed intrinsics.
- It triangulates from the first and last observations and measures residuals in every observed frame. The observations used for triangulation are also part of the evaluation, so this is a consistency diagnostic, not independent ground truth.
- The camera path is still monocular and unit-scale. Calibration remains provisional.
- Translation regularization does not optimize rotations or 3D landmarks jointly. It is not bundle adjustment.
- The evaluator's result must be interpreted alongside the number of landmarks evaluated and skipped. If too few full-clip tracks survive, it reports insufficient data rather than inventing an error.
- The app still does not produce a verified globally aligned, metric, walkable 3D environment.

## Verification status
- GitHub source files and UI integration were re-fetched after committing and their presence was confirmed.
- Regression tests were added but were not executed in this session.
- The latest commit's combined GitHub status endpoint returned no status entries. CI and deployment therefore remain unconfirmed.
- Browser execution of the updated Reconstruction Lab with the uploaded video remains outstanding.

## Next milestone
Validate the evaluator in the browser with the original video, confirm enough persistent tracks survive, compare raw versus regularized reprojection residuals, then improve calibration and move toward joint camera/landmark bundle adjustment. Do not increase overall completion percentage until a recognizable 3D result is demonstrated.
