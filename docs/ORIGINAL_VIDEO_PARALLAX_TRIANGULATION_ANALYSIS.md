# Original-Video Parallax and Triangulation-Angle Analysis

## Purpose

This experiment measures whether adjacent views in the original waterfront clip have enough camera-baseline parallax to support stable depth. It also motivates the new Reconstruction Lab triangulation-angle diagnostic.

## Source and method

- Source: `IMG_1325(1).mov`
- 1920 × 1080, 29.997 FPS, 595 frames, 19.835 seconds
- 40 frames sampled every 0.5 seconds and resized to 640 × 360
- Up to 2,500 ORB features per frame
- Hamming KNN matching with a 0.75 ratio threshold
- Essential matrix estimated with RANSAC (1.5-pixel threshold)
- Relative pose recovered with cheirality selection using provisional intrinsics K = [[640,0,320],[0,640,180],[0,0,1]]
- Triangulated matched inliers independently for each adjacent pair; no global bundle adjustment or cross-pair point fusion was used for these measurements

## Results

| Measurement | Result |
|---|---:|
| Adjacent frame pairs | 39 |
| Pairs with relative pose recovered | 39 / 39 |
| Median essential-matrix RANSAC inliers | 153 |
| Median cheirality-selected points | 153 |
| Median positive-depth triangulated points per pair | 153 |
| Median two-view reprojection error | 0.385 px |
| Median triangulation angle | 4.60° |
| Pairs with median angle above 5° | 19 / 39 |
| Pairs with median angle above 10° | 7 / 39 |

Triangulation-angle distribution across accepted points:
- 10th percentile: 0.63°
- 25th percentile: 1.87°
- 50th percentile: 4.60°
- 75th percentile: 8.29°
- 90th percentile: 13.22°

## Interpretation

The clip has good local feature correspondence and low two-view reprojection residuals under the provisional calibration. However, the median triangulation angle is only 4.60°, and only 7 of 39 pair medians exceed 10°. This is a warning that depth may be poorly conditioned for many observations. A small reprojection error does not guarantee accurate depth: points at long range or under a small baseline can fit both images while having large depth uncertainty.

The pose and depth results are provisional because focal length and principal point are assumptions, lens distortion has not been calibrated, and pairwise translations have arbitrary unit scale. Moving people, water, reflections, rolling shutter, and stabilization can also contaminate matches.

## Application change

The Reconstruction Lab now reports per-pair and overall median triangulation angle, and counts accepted points below a configurable low-parallax warning threshold (default 2 degrees). Low-angle points are flagged, not silently discarded, so users can inspect the trade-off. This is a quality diagnostic; it does not itself improve camera calibration or solve global trajectory drift.

## Next engineering gate

1. Obtain trusted intrinsics and distortion coefficients for the exact recording mode.
2. Track static background features across more than two frames.
3. Estimate poses from robust static-track subsets and compare stability.
4. Optimize the trajectory globally before treating pairwise clouds as one world.
5. Evaluate depth uncertainty and require stronger parallax for surfaces intended for navigation.
6. Capture additional overlapping viewpoints if the existing clip does not provide enough baseline or coverage.

## Source-faithful constraint

All geometry must be supported by measured pixels in the original video. Do not synthesize, inpaint, or invent buildings, people, water, textures, or unseen surfaces. Unsupported regions remain unknown.

## Reproduction note

These values are from an independent local OpenCV diagnostic of the uploaded clip. They are not a full end-to-end browser Reconstruction Lab run, and they do not establish a coherent, metric, walkable 3D environment.
