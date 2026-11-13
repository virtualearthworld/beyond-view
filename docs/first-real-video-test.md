# Beyond View: original waterfront video validation

## Target source — do not substitute another clip

The target is the user's existing `IMG_1325(1).mov` waterfront video. It is a normal real-world recording, not a staged single-object orbit capture. Preserve the actual people, waterfront, skyline, water, reflections, and camera movement. Do not replace it with a demo scene or ask for a different recording.

Previously recorded metadata:
- 1920 × 1080
- approximately 29.9975 FPS
- 595 frames
- 19.835 seconds
- approximately 37.9 MB

The original video is not committed to this public repository.

## Historical independent diagnostics

These measurements were collected in earlier local OpenCV experiments on the exact source file. They are not a fresh browser Reconstruction Lab run:

| Measurement | Historical result |
|---|---:|
| Sampled frames in camera-coverage audit | 40 |
| Adjacent pairs | 39 |
| Median ratio-filtered ORB matches per pair | 310 |
| Median fundamental-matrix RANSAC inliers | 210 |
| Median homography inliers | 146 |
| Median occupied image-grid cells | 7 of 12 |
| Pairs with at least 8 fundamental-matrix inliers | 39 / 39 |
| Pairs with relative pose recovered in parallax audit | 39 / 39 |
| Median per-pair triangulation angle | 4.60° |
| Accepted pair-local observations below 2° | 27.3% |
| Median two-view reprojection error | approximately 0.388 px |

Good correspondence counts justify continued investigation. Low triangulation angles warn that depth is poorly conditioned for many observations. Low pairwise reprojection error does not prove accurate depth, a globally stable camera path, or a walkable 3D environment.

## Current application flow for the original file

1. Open the [Beyond View main workspace](../index.html) and then the [Reconstruction Lab](../reconstruction-lab.html).
2. Choose the existing `IMG_1325(1).mov` in the Lab's single video picker.
3. Wait until the browser reports that the video has decoded and enables **Analyze video**.
4. Press **Analyze video** to start. Choosing the file alone does not run analysis.
5. The Lab processes the selected local file in the browser. It does not upload the clip, open a second upload page, or require a ZIP/frame handoff.

The current Lab samples up to 32 frames at 0.75-second intervals and 480-pixel width. This is different from the historical 40-frame/0.5-second OpenCV audit above.

## What must be checked

- How many adjacent pairs yield valid relative camera poses in the browser pipeline.
- How many persistent tracks survive across the sampled clip.
- Whether the estimated trajectory remains in connected components or has explicit failed gaps.
- Raw versus refined reprojection error using the same landmarks.
- Accepted/rejected sparse 3D points and connected cloud components.
- Triangulation-angle distribution and the fraction below the 2° warning threshold.
- Whether the exported PLY resembles measured geometry from the waterfront source rather than noise or a fragmented pair-local cloud.

The source contains moving foreground people and water/reflections. Homography residuals are not semantic person/water detections; they can also represent parallax, occlusion, reflection, or tracking error. The current Lab does not yet have a validated semantic mask that guarantees these moving regions are excluded from static geometry. Preserve ambiguous tracks as uncertain.

## Acceptance gate

A recognizable, source-faithful sparse reconstruction of the actual waterfront clip must be supported by stable multi-frame camera poses, measured reprojection, source-frame inspection, and conservative handling of moving content. It is not yet the final 3D Gaussian-splat experience. Do not call the video successfully reconstructed until the geometry can be inspected against its source frames and unsupported regions remain unavailable.

The separate Gausify Orbit build is not currently connected to the Lab's selected video. A dense 3DGS or mesh stage must be evaluated on this same clip only after the camera and geometry evidence is strong enough.
