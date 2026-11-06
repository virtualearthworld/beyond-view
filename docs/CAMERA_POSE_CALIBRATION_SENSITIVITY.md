# Camera-Pose Calibration Sensitivity — Original Waterfront Clip

## Purpose

This report tests whether two-view relative-pose recovery is sensitive to a provisional focal-length assumption. It is an exploratory calibration-sensitivity check, not a camera calibration result and not a completed 3D reconstruction.

## Source and sampling

- Source: IMG_1325(1).mov
- Original dimensions: 1920 × 1080
- Duration: 19.835 seconds; 595 frames
- 39 grayscale frames sampled at 0.5-second intervals, resized to 640 × 360
- ORB feature matching between 38 adjacent sampled pairs, Hamming KNN with a 0.75 ratio test
- Essential matrix estimated with RANSAC (1.5-pixel threshold); relative pose selected using OpenCV recoverPose cheirality

## Provisional intrinsics tested

Assumed square pixels and principal point (320, 180). Focal length swept across 0.8, 1.0, 1.2, 1.4, and 1.6 times the 640-pixel analysis width. These are sensitivity assumptions only; the video metadata did not provide a verified focal length or camera calibration.

| Assumed focal length | Relative-pose pairs recovered | Median cheirality inliers |
|---:|---:|---:|
| 512 px (0.8 × width) | 38 / 38 | 142 |
| 640 px (1.0 × width) | 38 / 38 | 152.5 |
| 768 px (1.2 × width) | 38 / 38 | 152 |
| 896 px (1.4 × width) | 38 / 38 | 145 |
| 1024 px (1.6 × width) | 38 / 38 | 150.5 |

## Interpretation

- Relative pose recovery succeeded for all 38 adjacent pairs across this tested focal range. This supports proceeding to deeper validation rather than abandoning the clip.
- The median cheirality inlier count varied from 142 to 152.5. Successful cheirality selection does not prove that the recovered poses are accurate.
- The sweep cannot validate the assumed focal length, principal point, lens distortion, rolling shutter, or camera stabilization behavior.
- Adjacent-pair translation direction is scale-ambiguous. Chaining pairwise poses can drift, especially in a short clip with moving foreground subjects and water.
- The result is an independent OpenCV experiment, not a run of the browser app's complete end-to-end pipeline.

## Next engineering gate

1. Obtain verified camera intrinsics for the exact video mode, or calibrate the camera using a suitable calibration target and matching resolution/focus mode.
2. Apply distortion correction before feature tracking when calibration provides distortion coefficients.
3. Build persistent multi-frame tracks and identify static-background candidates without deleting ambiguous or dynamic observations.
4. Compare robust pairwise poses across focal assumptions and track subsets; report pose stability and failed segments.
5. Run bundle adjustment or another global consistency optimization before fusing points into one coordinate frame.
6. Report triangulation angle, positive-depth ratio, reprojection error, connected components, and drift diagnostics.

## Source-faithful constraint

Use only measured pixels and supported geometry from the original video. Do not generate or inpaint people, buildings, water, textures, or unseen surfaces. Keep source timestamps and provenance attached to derived observations. Any region not supported by the captured views must remain unavailable or explicitly marked as unknown.

## Reproduction note

Measurements above were produced by a local OpenCV analysis of the uploaded source clip. They are not proof of metric depth, a globally consistent trajectory, or a navigable environment.